// Enterprise-Grade Apple StoreKit 2 Webhook Handler
// Processes real-time subscription events from Apple
// Handles: trial conversions, renewals, cancellations, billing issues

import { Logger } from '../utils/ProductionLogger';
import { TrialManagementService } from './TrialManagementService';
import { NewSubscriptionService } from './NewSubscriptionService';
import { supabase } from './supabaseClient';

export interface AppleWebhookPayload {
  notificationType: string;
  subtype?: string;
  data: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

export interface DecodedTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  offerType?: number; // 1 = introductory, 2 = promotional, 3 = subscription offer code
  inAppOwnershipType?: string;
}

export class AppleWebhookHandler {
  /**
   * PHASE 2A: Main webhook processor
   * Routes events to appropriate handlers
   */
  static async processWebhook(payload: AppleWebhookPayload): Promise<{ success: boolean; message: string }> {
    try {
      const { notificationType, subtype, data } = payload;

      Logger.info('[AppleWebhook] Processing webhook', {
        notificationType,
        subtype,
        timestamp: new Date().toISOString(),
      });

      // Decode transaction info (in production, verify JWT signature)
      const transaction = await this.decodeTransactionInfo(data.signedTransactionInfo);
      if (!transaction) {
        return { success: false, message: 'Failed to decode transaction' };
      }

      // Find user by original transaction ID
      const userId = await this.findUserByTransactionId(transaction.originalTransactionId);
      if (!userId) {
        Logger.warn('[AppleWebhook] User not found for transaction', {
          transactionId: transaction.transactionId,
        });
        return { success: false, message: 'User not found' };
      }

      // Route to appropriate handler based on notification type
      switch (notificationType) {
        case 'DID_RENEW':
          return await this.handleDidRenew(userId, transaction, subtype);

        case 'DID_CHANGE_RENEWAL_STATUS':
          return await this.handleRenewalStatusChange(userId, transaction, subtype);

        case 'DID_FAIL_TO_RENEW':
          return await this.handleFailedRenewal(userId, transaction, subtype);

        case 'EXPIRED':
          return await this.handleExpiration(userId, transaction, subtype);

        case 'GRACE_PERIOD_EXPIRED':
          return await this.handleGracePeriodExpired(userId, transaction);

        case 'REFUND':
          return await this.handleRefund(userId, transaction);

        default:
          Logger.info('[AppleWebhook] Unhandled notification type', { notificationType });
          return { success: true, message: 'Notification type not handled' };
      }
    } catch (error) {
      Logger.error('[AppleWebhook] Exception processing webhook', error as Error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PHASE 2B: Handle DID_RENEW - Trial conversion or regular renewal
   */
  private static async handleDidRenew(
    userId: string,
    transaction: DecodedTransaction,
    subtype?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('[AppleWebhook] Handling DID_RENEW', { userId, subtype, transactionId: transaction.transactionId });

      // Get current subscription
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      // Check if this is a trial conversion (offerType = 1 means introductory/trial)
      const isTrialConversion = subscription.tier === 'free_trial' && transaction.offerType === 1;

      if (isTrialConversion) {
        // CRITICAL: Trial period ended, Apple charged user - convert to paid
        Logger.info('[AppleWebhook] 🎉 Trial converting to paid (Apple charged after 3 days)', {
          userId,
          transactionId: transaction.transactionId,
        });

        const result = await TrialManagementService.convertTrialToPaid(userId, transaction.transactionId);

        if (result.success) {
          // Clear any billing issues
          await this.clearBillingIssues(userId);

          return {
            success: true,
            message: `Trial converted to ${result.toTier} successfully`,
          };
        } else {
          return { success: false, message: result.error || 'Trial conversion failed' };
        }
      } else {
        // Regular renewal - just update transaction ID and clear billing issues
        await supabase
          .from('user_subscriptions_new')
          .update({
            platform_transaction_id: transaction.transactionId,
            billing_issue: false,
            grace_period_end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        Logger.info('[AppleWebhook] ✅ Regular renewal processed', { userId, transactionId: transaction.transactionId });

        return { success: true, message: 'Renewal processed successfully' };
      }
    } catch (error) {
      Logger.error('[AppleWebhook] Exception in handleDidRenew', error as Error, { userId });
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PHASE 2C: Handle DID_CHANGE_RENEWAL_STATUS - User cancelled auto-renewal
   */
  private static async handleRenewalStatusChange(
    userId: string,
    transaction: DecodedTransaction,
    subtype?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('[AppleWebhook] Handling renewal status change', { userId, subtype });

      if (subtype === 'AUTO_RENEW_DISABLED') {
        // User cancelled - mark subscription but keep access until expiration
        const subscription = await NewSubscriptionService.getUserSubscription(userId);

        if (subscription.tier === 'free_trial') {
          // User cancelled during trial - revert to seeker immediately
          const result = await TrialManagementService.cancelTrial(userId);
          return {
            success: result.success,
            message: result.success ? 'Trial cancelled, reverted to seeker' : result.error || 'Cancellation failed',
          };
        } else {
          // Regular subscription cancelled - keep access until expiration
          await supabase
            .from('user_subscriptions_new')
            .update({
              auto_renew_enabled: false,
              cancellation_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          Logger.info('[AppleWebhook] ✅ Auto-renewal disabled', { userId });
          return { success: true, message: 'Auto-renewal disabled, access continues until expiration' };
        }
      } else if (subtype === 'AUTO_RENEW_ENABLED') {
        // User re-enabled auto-renewal
        await supabase
          .from('user_subscriptions_new')
          .update({
            auto_renew_enabled: true,
            cancellation_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        Logger.info('[AppleWebhook] ✅ Auto-renewal re-enabled', { userId });
        return { success: true, message: 'Auto-renewal re-enabled' };
      }

      return { success: true, message: 'Renewal status change processed' };
    } catch (error) {
      Logger.error('[AppleWebhook] Exception in handleRenewalStatusChange', error as Error, { userId });
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PHASE 2D: Handle DID_FAIL_TO_RENEW - Payment failure, enter grace period
   */
  private static async handleFailedRenewal(
    userId: string,
    transaction: DecodedTransaction,
    subtype?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('[AppleWebhook] Handling failed renewal', { userId, subtype });

      // Enter grace period (3 days custom)
      const result = await TrialManagementService.handlePaymentFailure(userId, 3);

      if (result.success) {
        Logger.info('[AppleWebhook] ✅ Grace period activated', {
          userId,
          gracePeriodEnd: result.gracePeriodEnd,
        });
        return { success: true, message: 'Grace period activated' };
      } else {
        return { success: false, message: result.error || 'Failed to activate grace period' };
      }
    } catch (error) {
      Logger.error('[AppleWebhook] Exception in handleFailedRenewal', error as Error, { userId });
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PHASE 2E: Handle EXPIRED - Subscription expired, revert to seeker
   */
  private static async handleExpiration(
    userId: string,
    transaction: DecodedTransaction,
    subtype?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('[AppleWebhook] Handling expiration', { userId, subtype });

      // Revert to seeker tier
      const seekerLimits = NewSubscriptionService.getTierLimits('seeker');

      await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          subscription_display_name: 'siFia Seeker',
          playbooks_limit: seekerLimits.playbooks_limit,
          devotionals_limit: seekerLimits.devotionals_limit,
          playbooks_used: 0,
          devotionals_used: 0,
          smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
          subscription_end_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      Logger.info('[AppleWebhook] ✅ Subscription expired, reverted to seeker', { userId });
      return { success: true, message: 'Subscription expired, reverted to seeker' };
    } catch (error) {
      Logger.error('[AppleWebhook] Exception in handleExpiration', error as Error, { userId });
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PHASE 2F: Handle GRACE_PERIOD_EXPIRED - Grace period ended without payment
   */
  private static async handleGracePeriodExpired(
    userId: string,
    _transaction: DecodedTransaction,
  ): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('[AppleWebhook] Handling grace period expiration', { userId });

      // Revert to seeker tier
      const seekerLimits = NewSubscriptionService.getTierLimits('seeker');

      await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          subscription_display_name: 'siFia Seeker',
          playbooks_limit: seekerLimits.playbooks_limit,
          devotionals_limit: seekerLimits.devotionals_limit,
          playbooks_used: 0,
          devotionals_used: 0,
          smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
          billing_issue: false,
          grace_period_end_date: null,
          subscription_end_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      Logger.info('[AppleWebhook] ✅ Grace period expired, reverted to seeker', { userId });
      return { success: true, message: 'Grace period expired, reverted to seeker' };
    } catch (error) {
      Logger.error('[AppleWebhook] Exception in handleGracePeriodExpired', error as Error, { userId });
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PHASE 2G: Handle REFUND - User refunded, revert to seeker
   */
  private static async handleRefund(
    userId: string,
    transaction: DecodedTransaction,
  ): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('[AppleWebhook] Handling refund', { userId, transactionId: transaction.transactionId });

      // Revert to seeker tier
      const seekerLimits = NewSubscriptionService.getTierLimits('seeker');

      await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          subscription_display_name: 'siFia Seeker',
          playbooks_limit: seekerLimits.playbooks_limit,
          devotionals_limit: seekerLimits.devotionals_limit,
          playbooks_used: 0,
          devotionals_used: 0,
          smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
          refund_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      Logger.info('[AppleWebhook] ✅ Refund processed, reverted to seeker', { userId });
      return { success: true, message: 'Refund processed, reverted to seeker' };
    } catch (error) {
      Logger.error('[AppleWebhook] Exception in handleRefund', error as Error, { userId });
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Helper: Decode transaction info (simplified - in production, verify JWT)
   */
  private static async decodeTransactionInfo(signedInfo?: string): Promise<DecodedTransaction | null> {
    if (!signedInfo) {
      return null;
    }

    try {
      // In production: Verify JWT signature with Apple's public key
      // For now, decode the base64 payload
      const parts = signedInfo.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload as DecodedTransaction;
    } catch (error) {
      Logger.error('[AppleWebhook] Failed to decode transaction', error as Error);
      return null;
    }
  }

  /**
   * Helper: Find user by original transaction ID
   */
  private static async findUserByTransactionId(transactionId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions_new')
        .select('user_id')
        .eq('platform_transaction_id', transactionId)
        .single();

      if (error || !data) {
      return null;
    }
      return data.user_id;
    } catch (error) {
      Logger.error('[AppleWebhook] Failed to find user', error as Error);
      return null;
    }
  }

  /**
   * Helper: Clear billing issues
   */
  private static async clearBillingIssues(userId: string): Promise<void> {
    await supabase
      .from('user_subscriptions_new')
      .update({
        billing_issue: false,
        grace_period_end_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }
}
