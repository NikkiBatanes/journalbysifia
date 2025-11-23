import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

export type BugReportPayload = {
  user_id: string | null;
  message: string;
  platform: string;
  os_version: string;
  screen: string;
  app_version?: string | null;
  extra?: any;
};

/**
 * Submit a bug report to the database
 * @throws Error with user-friendly message if submission fails
 */
export async function reportBug(payload: BugReportPayload) {
  try {
    // Validate required fields
    if (!payload.message?.trim()) {
      throw new Error('Please describe the issue before submitting.');
    }

    Logger.info('Submitting bug report', {
      component: 'bugReportService',
      user_id: payload.user_id,
      screen: payload.screen,
    });

    // Insert into 'bug_reports' table
    const { data, error } = await supabase
      .from('bug_reports')
      .insert({
        user_id: payload.user_id,
        message: payload.message,
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
      Logger.info('RAW SUPABASE ERROR:', error);
      Logger.info('Error type:', typeof error);
      Logger.info('Error keys:', Object.keys(error));
      Logger.info('Error.code:', error.code);
      Logger.info('Error.message:', error.message);
      Logger.info('Error.details:', error.details);
      Logger.info('Error.hint:', error.hint);
      Logger.info('Error stringified:', JSON.stringify(error));

      // Extract meaningful error information
      const errorCode = error.code || 'UNKNOWN';
      const errorMessage = error.message || error.hint || error.details || 'Unknown database error';

      // Log detailed error for debugging
      Logger.error('Bug report submission failed', new Error(errorMessage), {
        component: 'bugReportService',
        errorCode,
        errorMessage: error.message,
        errorHint: error.hint,
        errorDetails: error.details,
        rawError: String(error),
        payload: {
          user_id: payload.user_id,
          platform: payload.platform,
          screen: payload.screen,
        },
      });

      // Provide user-friendly error messages based on error code
      if (errorCode === '42P01') {
        throw new Error('Bug reporting is currently unavailable. Please contact support.');
      } else if (errorCode === '23505') {
        throw new Error('This bug report has already been submitted.');
      } else if (errorCode.startsWith('23')) {
        throw new Error('Invalid bug report data. Please try again.');
      } else if (errorCode.startsWith('42')) {
        throw new Error('Bug reporting system is not configured. Please contact support.');
      } else {
        throw new Error(errorMessage || 'Failed to submit bug report. Please try again.');
      }
    }

    Logger.info('Bug report submitted successfully', {
      component: 'bugReportService',
      reportId: data?.id,
    });

    return data;
  } catch (error) {
    // If it's already an Error with a message, re-throw it
    if (error instanceof Error) {
      throw error;
    }

    // Otherwise, wrap it in a generic error
    Logger.error('Unexpected error in reportBug', new Error(String(error)), {
      component: 'bugReportService',
      errorType: typeof error,
    });

    throw new Error('Failed to submit bug report. Please check your connection and try again.');
  }
}
