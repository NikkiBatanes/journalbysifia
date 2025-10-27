import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { authErrorHandler } from '../utils/authErrorHandler';
import { validateSession, forceSessionRefresh } from '../utils/sessionSync';
import { AUTH_ERROR_MESSAGES } from '../constants/sessionConstants';
import { generateDevotional as modernGenerateDevotional, validateDevotionalParams } from './modernDevotionalApi';
import {
  generatePlaybook as modernGeneratePlaybook,
  savePlaybook as modernSavePlaybook,
  updatePlaybookActionSteps as modernUpdatePlaybookActionSteps,
  deletePlaybook as modernDeletePlaybook,
  getPlaybook as modernGetPlaybook,
  validatePlaybookParams,
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
 * Enhanced generateDevotional with proper auth integration
 */
export async function generateDevotional(
  duration: number,
  playbookId?: string,
  userInput?: string,
  options: {
    showUserFeedback?: boolean;
    onAuthRequired?: () => void;
  } = {}
): Promise<any> {
  const { showUserFeedback = true, onAuthRequired } = options;

  try {

    // Validate parameters
    validateDevotionalParams({ duration, playbookId, userInput });

    // Validate session using comprehensive validation
    const { isValid, diagnostics } = await validateSession();

    if (!isValid) {
      Logger.error('❌ Invalid session for devotional generation', undefined, {
        component: 'apiIntegration',
        diagnostics,
      });

      // Try to refresh session once before giving up
      if (diagnostics.hasSession && diagnostics.hasToken && diagnostics.isExpired) {

        const refreshResult = await forceSessionRefresh();

        if (refreshResult.success) {

          // Retry with refreshed session
          return generateDevotional(duration, playbookId, userInput, options);
        }
      }

      const result = await authErrorHandler.handleApiError(
        { status: 401, message: AUTH_ERROR_MESSAGES.NO_SESSION },
        {
          operationName: 'devotional generation',
          showUserFeedback,
          onAuthRequired,
        }
      );

      if (!result.handled) {
        throw new Error('Authentication required for devotional generation');
      }

      return null;
    }

    // Use modern devotional generation (no AsyncStorage bridge needed)
    try {
      const result = await modernGenerateDevotional({ duration, playbookId, userInput });

      return result;
    } catch (error: any) {
      // Handle specific authentication errors
      if (error.message.includes('session') || error.message.includes('token')) {
        const result = await authErrorHandler.handleApiError(error, {
          operationName: 'devotional generation',
          showUserFeedback,
          onAuthRequired,
        });

        if (!result.handled) {
          throw error;
        }

        return null;
      }

      // Re-throw non-auth errors
      throw error;
    }

  } catch (error: any) {
    Logger.error('❌ Devotional generation failed', error as Error, {
      component: 'apiIntegration',
    });

    const result = await authErrorHandler.handleApiError(error, {
      operationName: 'devotional generation',
      showUserFeedback,
      retryAttempts: 2,
      onAuthRequired,
    });

    if (result.shouldRetry) {

      return generateDevotional(duration, playbookId, userInput, options);
    }

    if (!result.handled) {
      throw error;
    }

    return null;
  }
}

/**
 * Enhanced generatePlaybook with proper auth integration
 */
export async function generatePlaybook(
  userInput: string,
  userName: string,
  options: {
    showUserFeedback?: boolean;
    onAuthRequired?: () => void;
    _retryCount?: number;
  } = {}
): Promise<any> {
  const { showUserFeedback = true, onAuthRequired, _retryCount = 0 } = options;
  const MAX_RETRIES = 2;

  if (_retryCount > MAX_RETRIES) {
    Logger.error('[generatePlaybook] Max retries exceeded, aborting', undefined, {
      component: 'apiIntegration',
    });
    throw new Error('Maximum retry attempts exceeded for playbook generation');
  }

  try {

    // Validate session using comprehensive validation
    const { isValid, diagnostics } = await validateSession();

    if (!isValid) {
      Logger.error('❌ Invalid session for playbook generation', undefined, {
        component: 'apiIntegration',
        diagnostics,
      });

      // Try to refresh session once before giving up
      if (diagnostics.hasSession && diagnostics.hasToken && diagnostics.isExpired) {

        const refreshResult = await forceSessionRefresh();

        if (refreshResult.success) {

          // Retry with refreshed session
          return generatePlaybook(userInput, userName, { ...options, _retryCount: _retryCount + 1 });
        }
      }

      const result = await authErrorHandler.handleApiError(
        { status: 401, message: AUTH_ERROR_MESSAGES.NO_SESSION },
        {
          operationName: 'playbook generation',
          showUserFeedback,
          onAuthRequired,
        }
      );

      if (!result.handled) {
        throw new Error('Authentication required for playbook generation');
      }

      return null;
    }

    // Validate parameters
    validatePlaybookParams(userInput, userName);

    // Use modern playbook generation (no AsyncStorage bridge needed)
    try {
      const result = await modernGeneratePlaybook(userInput, userName);

      return result;
    } catch (error: any) {
      // Handle specific authentication errors
      if (error.message.includes('session') || error.message.includes('token')) {
        const result = await authErrorHandler.handleApiError(error, {
          operationName: 'playbook generation',
          showUserFeedback,
          onAuthRequired,
        });

        if (!result.handled) {
          throw error;
        }

        return null;
      }

      // Re-throw non-auth errors
      throw error;
    }

  } catch (error: any) {
    Logger.error('❌ Playbook generation failed', error as Error, {
      component: 'apiIntegration',
    });

    const result = await authErrorHandler.handleApiError(error, {
      operationName: 'playbook generation',
      showUserFeedback,
      retryAttempts: 2,
      onAuthRequired,
    });

    if (result.shouldRetry) {

      return generatePlaybook(userInput, userName, { ...options, _retryCount: _retryCount + 1 });
    }

    if (!result.handled) {
      throw error;
    }

    return null;
  }
}

/**
 * Enhanced getPlaybooks with proper auth integration
 */
export async function getPlaybooks(
  userId: string,
  options: {
    showUserFeedback?: boolean;
    onAuthRequired?: () => void;
  } = {}
): Promise<any[]> {
  const { showUserFeedback = false, onAuthRequired } = options;

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
      const result = await normalizedGetPlaybooks(userId);

      return result;
    } catch (error: any) {
      // Handle specific authentication errors
      if (error.message.includes('session') || error.message.includes('token')) {
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
      retryAttempts: 1,
      onAuthRequired,
    });

    if (result.shouldRetry) {

      return getPlaybooks(userId, options);
    }

    if (!result.handled) {
      throw error;
    }

    return [];
  }
}

// Direct exports of modern functions (session handled by Supabase client)
// These functions use fresh JWT tokens directly from Supabase
export const savePlaybook = modernSavePlaybook;
export const updatePlaybookActionSteps = modernUpdatePlaybookActionSteps;
export const deletePlaybook = modernDeletePlaybook;
export const getPlaybook = modernGetPlaybook;
export const calculateTaskStats = normalizedCalculateTaskStats;
