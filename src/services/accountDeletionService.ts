/**
 * Enterprise-grade account deletion service
 * Handles secure account deletion with grace period and proper validation
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

export interface AccountDeletionRequest {
  userId: string;
  birthYear: string;
  confirmationToken?: string;
}

export interface AccountDeletionResponse {
  success: boolean;
  message: string;
  deletionId?: string;
  gracePeriodEnds?: string;
  remainingDays?: number;
}

export interface AccountDeletionStatus {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  gracePeriodEnds?: string;
  requestedAt?: string;
  completedAt?: string;
  remainingDays?: number;
}

class AccountDeletionService {
  private static instance: AccountDeletionService;

  static getInstance(): AccountDeletionService {
    if (!AccountDeletionService.instance) {
      AccountDeletionService.instance = new AccountDeletionService();
    }
    return AccountDeletionService.instance;
  }

  /**
   * Initiates account deletion with grace period
   */
  async initiateAccountDeletion(request: AccountDeletionRequest): Promise<AccountDeletionResponse> {
    try {
      Logger.debug('[AccountDeletionService] Initiating account deletion', {
        component: 'AccountDeletionService',
        userId: request.userId,
      });

      // Call the edge function for secure processing
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: request,
      });

      if (error) {
        Logger.error('Account deletion initiation failed', error as Error, {
          component: 'AccountDeletionService',
          userId: request.userId,
        });
        throw error;
      }

      Logger.debug('[AccountDeletionService] Account deletion initiated successfully', {
        component: 'AccountDeletionService',
        deletionId: data?.deletionId,
      });

      return data as AccountDeletionResponse;
    } catch (error) {
      Logger.error('Failed to initiate account deletion', error as Error, {
        component: 'AccountDeletionService',
        userId: request.userId,
      });
      throw error;
    }
  }

  /**
   * Checks the status of an account deletion request
   */
  async getDeletionStatus(userId: string): Promise<AccountDeletionStatus | null> {
    try {
      const { data, error } = await supabase
        .from('account_deletions')
        .select('*')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      if (!data) {
        return null;
      }

      // Calculate remaining days if pending
      let remainingDays = 0;
      if (data.status === 'pending' && data.grace_period_ends) {
        const gracePeriodEnds = new Date(data.grace_period_ends);
        remainingDays = Math.ceil((gracePeriodEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        remainingDays = Math.max(0, remainingDays);
      }

      return {
        status: data.status,
        gracePeriodEnds: data.grace_period_ends,
        requestedAt: data.requested_at,
        completedAt: data.completed_at,
        remainingDays,
      };
    } catch (error) {
      Logger.error('Failed to get deletion status', error as Error, {
        component: 'AccountDeletionService',
        userId,
      });
      throw error;
    }
  }

  /**
   * Cancels a pending account deletion
   */
  async cancelAccountDeletion(userId: string, deletionId: string): Promise<boolean> {
    try {
      Logger.debug('[AccountDeletionService] Cancelling account deletion', {
        component: 'AccountDeletionService',
        userId,
        deletionId,
      });

      const { error } = await supabase
        .from('account_deletions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          deletion_notes: 'Cancelled by user request',
        })
        .eq('id', deletionId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) {
        Logger.error('Failed to cancel account deletion', error as Error, {
          component: 'AccountDeletionService',
          userId,
          deletionId,
        });
        throw error;
      }

      Logger.debug('[AccountDeletionService] Account deletion cancelled successfully', {
        component: 'AccountDeletionService',
        userId,
        deletionId,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to cancel account deletion', error as Error, {
        component: 'AccountDeletionService',
        userId,
      });
      throw error;
    }
  }

  /**
   * Validates birth year format and age requirements
   */
  validateBirthYear(birthYear: string): { isValid: boolean; error?: string } {
    const currentYear = new Date().getFullYear();
    const birthYearNum = parseInt(birthYear, 10);
    const MIN_AGE = 13;
    const MAX_AGE = 120;

    if (!birthYear || !/^\d{4}$/.test(birthYear)) {
      return { isValid: false, error: 'Please enter a valid 4-digit year' };
    }

    if (isNaN(birthYearNum)) {
      return { isValid: false, error: 'Invalid year format' };
    }

    if (birthYearNum < currentYear - MAX_AGE || birthYearNum > currentYear - MIN_AGE) {
      return {
        isValid: false,
        error: `Please enter a birth year between ${currentYear - MAX_AGE} and ${currentYear - MIN_AGE}`,
      };
    }

    return { isValid: true };
  }

  // Removed: immediateAccountDeletion relied on a mobile Supabase service-role client.
  // Account deletion now goes through the backend `delete-account` Edge Function only.
}

export const accountDeletionService = AccountDeletionService.getInstance();
