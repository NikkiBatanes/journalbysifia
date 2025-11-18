import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { FamilyPaymentService } from './FamilyPaymentService';

/**
 * FamilySubscriptionMonitor
 *
 * Enterprise-grade monitoring service for family subscriptions
 * Handles payment failures, grace periods, and automatic cleanup
 */

export interface SubscriptionStatus {
  familyGroupId: string;
  adminUserId: string;
  status: 'active' | 'grace_period' | 'expired';
  gracePeriodEndsAt?: string;
  lastPaymentAttempt?: string;
  paymentFailureCount: number;
}

export class FamilySubscriptionMonitor {
  // Grace period: 7 days after payment failure
  private static GRACE_PERIOD_DAYS = 7;

  // Maximum payment retry attempts
  private static MAX_PAYMENT_RETRIES = 3;

  /**
   * Check and process expired/failed family subscriptions
   * Should be run as a scheduled job (e.g., daily cron)
   */
  static async processExpiredSubscriptions(): Promise<{
    processed: number;
    cancelled: number;
    gracePeriodWarnings: number;
  }> {
    try {
      Logger.info('Starting family subscription expiry check', {
        component: 'FamilySubscriptionMonitor',
      });

      let processed = 0;
      let cancelled = 0;
      let gracePeriodWarnings = 0;

      // Get all active family groups
      const { data: familyGroups, error } = await supabase
        .from('family_subscription_groups')
        .select('*')
        .eq('status', 'active');

      if (error) {
        throw new Error(`Failed to fetch family groups: ${error.message}`);
      }

      if (!familyGroups || familyGroups.length === 0) {
        Logger.info('No active family groups to process');
        return { processed: 0, cancelled: 0, gracePeriodWarnings: 0 };
      }

      // Process each family group
      for (const group of familyGroups) {
        try {
          const status = await this.checkSubscriptionStatus(group.id);
          processed++;

          if (status.status === 'expired') {
            // Grace period has ended, cancel subscription
            const result = await FamilyPaymentService.handleFamilyCancellation(
              group.id,
              group.admin_user_id,
              'payment_failed'
            );

            if (result.success) {
              cancelled++;
              Logger.info('Family subscription cancelled due to payment failure', {
                familyGroupId: group.id,
                membersAffected: result.membersAffected,
              });
            }
          } else if (status.status === 'grace_period') {
            // Send warning notification to admin
            await this.sendGracePeriodWarning(
              group.id,
              group.admin_user_id,
              status.gracePeriodEndsAt!
            );
            gracePeriodWarnings++;
          }
        } catch (groupError) {
          Logger.error('Failed to process family group', groupError as Error, {
            component: 'FamilySubscriptionMonitor',
            familyGroupId: group.id,
          });
        }
      }

      Logger.info('Family subscription expiry check complete', {
        processed,
        cancelled,
        gracePeriodWarnings,
      });

      return { processed, cancelled, gracePeriodWarnings };
    } catch (error) {
      Logger.error('Failed to process expired subscriptions', error as Error, {
        component: 'FamilySubscriptionMonitor',
      });
      throw error;
    }
  }

  /**
   * Check subscription status for a specific family group
   */
  static async checkSubscriptionStatus(familyGroupId: string): Promise<SubscriptionStatus> {
    try {
      // Get family group
      const { data: group, error: groupError } = await supabase
        .from('family_subscription_groups')
        .select('*')
        .eq('id', familyGroupId)
        .single();

      if (groupError || !group) {
        throw new Error('Family group not found');
      }

      // Check if there's a platform subscription ID
      if (!group.platform_subscription_id) {
        // No platform subscription - assume active (trial or manual)
        return {
          familyGroupId,
          adminUserId: group.admin_user_id,
          status: 'active',
          paymentFailureCount: 0,
        };
      }

      // Check payment failure tracking
      const { data: failureRecord } = await supabase
        .from('family_payment_failures')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!failureRecord) {
        // No payment failures recorded
        return {
          familyGroupId,
          adminUserId: group.admin_user_id,
          status: 'active',
          paymentFailureCount: 0,
        };
      }

      const now = new Date();
      const gracePeriodEnd = new Date(failureRecord.grace_period_ends_at);

      if (now > gracePeriodEnd) {
        // Grace period expired
        return {
          familyGroupId,
          adminUserId: group.admin_user_id,
          status: 'expired',
          gracePeriodEndsAt: failureRecord.grace_period_ends_at,
          lastPaymentAttempt: failureRecord.last_attempt_at,
          paymentFailureCount: failureRecord.failure_count,
        };
      } else {
        // In grace period
        return {
          familyGroupId,
          adminUserId: group.admin_user_id,
          status: 'grace_period',
          gracePeriodEndsAt: failureRecord.grace_period_ends_at,
          lastPaymentAttempt: failureRecord.last_attempt_at,
          paymentFailureCount: failureRecord.failure_count,
        };
      }
    } catch (error) {
      Logger.error('Failed to check subscription status', error as Error, {
        component: 'FamilySubscriptionMonitor',
        familyGroupId,
      });
      throw error;
    }
  }

  /**
   * Record a payment failure
   */
  static async recordPaymentFailure(
    familyGroupId: string,
    adminUserId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      // Get existing failure record
      const { data: existingRecord } = await supabase
        .from('family_payment_failures')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .single();

      const failureCount = existingRecord ? existingRecord.failure_count + 1 : 1;
      const gracePeriodEndsAt = new Date();
      gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + this.GRACE_PERIOD_DAYS);

      if (existingRecord) {
        // Update existing record
        await supabase
          .from('family_payment_failures')
          .update({
            failure_count: failureCount,
            last_attempt_at: new Date().toISOString(),
            last_error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRecord.id);
      } else {
        // Create new record
        await supabase
          .from('family_payment_failures')
          .insert({
            family_group_id: familyGroupId,
            admin_user_id: adminUserId,
            failure_count: failureCount,
            first_failed_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            grace_period_ends_at: gracePeriodEndsAt.toISOString(),
            last_error_message: errorMessage,
            created_at: new Date().toISOString(),
          });
      }

      // Send immediate notification to admin
      await this.sendPaymentFailureNotification(
        familyGroupId,
        adminUserId,
        failureCount,
        gracePeriodEndsAt.toISOString()
      );

      Logger.info('Payment failure recorded', {
        familyGroupId,
        failureCount,
        gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
      });
    } catch (error) {
      Logger.error('Failed to record payment failure', error as Error, {
        component: 'FamilySubscriptionMonitor',
        familyGroupId,
      });
    }
  }

  /**
   * Send payment failure notification to admin
   */
  private static async sendPaymentFailureNotification(
    familyGroupId: string,
    adminUserId: string,
    failureCount: number,
    gracePeriodEndsAt: string
  ): Promise<void> {
    try {
      const gracePeriodDate = new Date(gracePeriodEndsAt);
      const daysRemaining = Math.ceil(
        (gracePeriodDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const message = failureCount === 1
        ? `Your family subscription payment has failed. Please update your payment method within ${daysRemaining} days to avoid service interruption.`
        : `Your family subscription payment has failed ${failureCount} times. Please update your payment method within ${daysRemaining} days to avoid cancellation.`;

      await supabase.from('notifications').insert({
        user_id: adminUserId,
        notification_type: 'payment_failed',
        title: 'Payment Failed',
        message,
        data: {
          family_group_id: familyGroupId,
          failure_count: failureCount,
          grace_period_ends_at: gracePeriodEndsAt,
          days_remaining: daysRemaining,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Failed to send payment failure notification', error as Error, {
        component: 'FamilySubscriptionMonitor',
      });
    }
  }

  /**
   * Send grace period warning notification
   */
  private static async sendGracePeriodWarning(
    familyGroupId: string,
    adminUserId: string,
    gracePeriodEndsAt: string
  ): Promise<void> {
    try {
      const gracePeriodDate = new Date(gracePeriodEndsAt);
      const daysRemaining = Math.ceil(
        (gracePeriodDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining <= 3) {
        // Send urgent warning for last 3 days
        const message = daysRemaining === 1
          ? 'Your family subscription will be cancelled tomorrow if payment is not received. Please update your payment method immediately.'
          : `Your family subscription will be cancelled in ${daysRemaining} days if payment is not received. Please update your payment method.`;

        await supabase.from('notifications').insert({
          user_id: adminUserId,
          notification_type: 'payment_warning',
          title: 'Urgent: Payment Required',
          message,
          data: {
            family_group_id: familyGroupId,
            grace_period_ends_at: gracePeriodEndsAt,
            days_remaining: daysRemaining,
            urgency: 'high',
          },
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      Logger.error('Failed to send grace period warning', error as Error, {
        component: 'FamilySubscriptionMonitor',
      });
    }
  }

  /**
   * Clear payment failure record (after successful payment)
   */
  static async clearPaymentFailure(familyGroupId: string): Promise<void> {
    try {
      await supabase
        .from('family_payment_failures')
        .delete()
        .eq('family_group_id', familyGroupId);

      Logger.info('Payment failure record cleared', { familyGroupId });
    } catch (error) {
      Logger.error('Failed to clear payment failure', error as Error, {
        component: 'FamilySubscriptionMonitor',
        familyGroupId,
      });
    }
  }
}

export default FamilySubscriptionMonitor;
