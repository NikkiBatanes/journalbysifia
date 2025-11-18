import { Logger } from '../utils/ProductionLogger';
import PlatformPaymentService from './PlatformPaymentService';
import { FamilySubscriptionService } from './FamilySubscriptionService';
import { NewSubscriptionService } from './NewSubscriptionService';
import { FamilyNotificationService } from './FamilyNotificationService';
import { supabase } from './supabaseClient';
import { PaymentPlatform } from '../types/subscription';

/**
 * FamilyPaymentService
 *
 * Enterprise-grade payment handling for family subscriptions
 * Integrates with Apple/Google payment platforms
 * Handles subscription creation, upgrades, and renewals
 */

export interface FamilyPaymentOptions {
  userId: string;
  groupName: string;
  maxMembers: number;
  billingCycle: 'monthly' | 'annual';
  platform: PaymentPlatform;
}

export interface FamilyUpgradeOptions {
  userId: string;
  currentTier: string;
  targetTier: 'family';
  billingCycle: 'monthly' | 'annual';
  platform: PaymentPlatform;
}

export class FamilyPaymentService {
  /**
   * Get family subscription product IDs
   */
  static getFamilyProductIds(): { monthly: string; annual: string } {
    return {
      monthly: 'com.sifia.family.monthly',
      annual: 'com.sifia.family.annual',
    };
  }

  /**
   * Get family subscription pricing
   */
  static getFamilyPricing(billingCycle: 'monthly' | 'annual'): number {
    // Prices in cents
    return billingCycle === 'monthly' ? 4499 : 44999;
  }

  /**
   * Initialize family subscription purchase
   */
  static async initiateFamilyPurchase(options: FamilyPaymentOptions): Promise<{
    success: boolean;
    familyGroupId?: string;
    subscriptionId?: string;
    error?: string;
  }> {
    try {
      Logger.info('Initiating family subscription purchase', {
        userId: options.userId,
        billingCycle: options.billingCycle,
        platform: options.platform,
      });

      // Get product ID based on billing cycle
      const productIds = this.getFamilyProductIds();
      const productId = options.billingCycle === 'monthly'
        ? productIds.monthly
        : productIds.annual;

      // Initiate platform payment
      const paymentResult = await PlatformPaymentService.purchaseSubscription(
        productId,
        options.platform
      );

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }

      // Create family group
      const familyGroup = await FamilySubscriptionService.createFamilyGroup({
        admin_user_id: options.userId,
        group_name: options.groupName,
        max_members: options.maxMembers,
        billing_cycle: options.billingCycle,
        platform_subscription_id: paymentResult.transactionId,
      });

      // Upgrade user subscription to family tier
      await NewSubscriptionService.upgradeSubscription(options.userId, {
        target_tier: 'family',
        platform: options.platform,
        billing_cycle: options.billingCycle,
        platform_subscription_id: paymentResult.transactionId,
        platform_transaction_id: paymentResult.transactionId,
      });

      Logger.info('Family subscription created successfully', {
        familyGroupId: familyGroup.id,
        userId: options.userId,
      });

      return {
        success: true,
        familyGroupId: familyGroup.id,
        subscriptionId: paymentResult.transactionId,
      };
    } catch (error) {
      Logger.error('Failed to initiate family purchase', error as Error, {
        component: 'FamilyPaymentService',
        userId: options.userId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upgrade existing subscription to family plan
   */
  static async upgradeToFamily(options: FamilyUpgradeOptions): Promise<{
    success: boolean;
    familyGroupId?: string;
    error?: string;
  }> {
    try {
      Logger.info('Upgrading to family subscription', {
        userId: options.userId,
        currentTier: options.currentTier,
      });

      // Get product ID
      const productIds = this.getFamilyProductIds();
      const productId = options.billingCycle === 'monthly'
        ? productIds.monthly
        : productIds.annual;

      // Calculate prorated amount if upgrading mid-cycle
      const proratedAmount = await this.calculateProration(
        options.userId,
        options.currentTier,
        'family',
        options.billingCycle
      );

      // Initiate platform payment with prorated amount
      const paymentResult = await PlatformPaymentService.purchaseSubscription(
        productId,
        options.platform,
        proratedAmount
      );

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }

      // Create family group with default name
      const familyGroup = await FamilySubscriptionService.createFamilyGroup({
        admin_user_id: options.userId,
        group_name: 'My Family',
        max_members: 5,
        billing_cycle: options.billingCycle,
        platform_subscription_id: paymentResult.transactionId,
      });

      // Upgrade subscription
      await NewSubscriptionService.upgradeSubscription(options.userId, {
        target_tier: 'family',
        platform: options.platform,
        billing_cycle: options.billingCycle,
        platform_subscription_id: paymentResult.transactionId,
        platform_transaction_id: paymentResult.transactionId,
        is_family_upgrade: true,
      });

      Logger.info('Successfully upgraded to family subscription', {
        familyGroupId: familyGroup.id,
        userId: options.userId,
      });

      return {
        success: true,
        familyGroupId: familyGroup.id,
      };
    } catch (error) {
      Logger.error('Failed to upgrade to family', error as Error, {
        component: 'FamilyPaymentService',
        userId: options.userId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate prorated amount for mid-cycle upgrade
   */
  private static async calculateProration(
    userId: string,
    currentTier: string,
    targetTier: string,
    billingCycle: 'monthly' | 'annual'
  ): Promise<number> {
    try {
      // Get current subscription
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (!subscription.subscription_start_date) {
        // No proration needed for new subscriptions
        return this.getFamilyPricing(billingCycle);
      }

      const startDate = new Date(subscription.subscription_start_date);
      const now = new Date();
      const cycleLength = billingCycle === 'monthly' ? 30 : 365;

      // Calculate days elapsed in current cycle
      const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, cycleLength - (daysElapsed % cycleLength));

      // Calculate prorated amount
      const familyPrice = this.getFamilyPricing(billingCycle);
      const currentPrice = this.getCurrentTierPrice(currentTier, billingCycle);

      const proratedRefund = (currentPrice * daysRemaining) / cycleLength;
      const proratedCharge = (familyPrice * daysRemaining) / cycleLength;

      const netAmount = Math.max(0, proratedCharge - proratedRefund);

      Logger.info('Calculated proration', {
        userId,
        daysRemaining,
        netAmount,
        familyPrice,
        currentPrice,
      });

      return Math.round(netAmount);
    } catch (error) {
      Logger.error('Failed to calculate proration', error as Error, {
        component: 'FamilyPaymentService',
      });
      // Return full price if calculation fails
      return this.getFamilyPricing(billingCycle);
    }
  }

  /**
   * Get current tier pricing
   */
  private static getCurrentTierPrice(tier: string, billingCycle: 'monthly' | 'annual'): number {
    const prices: Record<string, { monthly: number; annual: number }> = {
      spark: { monthly: 799, annual: 7999 },
      growth: { monthly: 1499, annual: 14999 },
      transformation: { monthly: 2499, annual: 24999 },
    };

    const tierPrices = prices[tier] || prices.spark;
    return billingCycle === 'monthly' ? tierPrices.monthly : tierPrices.annual;
  }

  /**
   * Handle family subscription renewal
   */
  static async handleFamilyRenewal(
    familyGroupId: string,
    transactionId: string
  ): Promise<boolean> {
    try {
      Logger.info('Processing family subscription renewal', {
        familyGroupId,
        transactionId,
      });

      // Update family group subscription dates
      // TODO: Implement renewal logic in FamilySubscriptionService

      // Log activity
      // TODO: Log renewal activity

      return true;
    } catch (error) {
      Logger.error('Failed to process family renewal', error as Error, {
        component: 'FamilyPaymentService',
        familyGroupId,
      });
      return false;
    }
  }

  /**
   * Handle family subscription cancellation
   * Enterprise-grade: Handles admin downgrade, member cleanup, notifications
   */
  static async handleFamilyCancellation(
    familyGroupId: string,
    adminUserId: string,
    reason: 'admin_cancelled' | 'payment_failed' | 'admin_downgraded' = 'admin_cancelled'
  ): Promise<{
    success: boolean;
    membersAffected: number;
    error?: string;
  }> {
    try {
      Logger.info('Processing family subscription cancellation', {
        familyGroupId,
        adminUserId,
        reason,
      });

      // Get family group and all members
      const familyGroup = await FamilySubscriptionService.getFamilyGroup(familyGroupId);

      if (!familyGroup) {
        throw new Error('Family group not found');
      }

      // Verify admin permissions
      if (familyGroup.admin_user_id !== adminUserId) {
        throw new Error('Only admin can cancel family subscription');
      }

      const memberIds = familyGroup.members.map(m => m.user_id);
      const nonAdminMembers = memberIds.filter(id => id !== adminUserId);

      // Step 1: Downgrade all non-admin members to seeker tier
      if (nonAdminMembers.length > 0) {
        const { error: memberDowngradeError } = await supabase
          .from('user_subscriptions_new')
          .update({
            tier: 'seeker',
            status: 'active',
            playbooks_limit: 0,
            devotionals_limit: 0,
            smart_journaling_enabled: false,
            playbooks_used: 0,
            devotionals_used: 0,
            family_group_id: null,
            family_role: null,
            subscription_display_name: 'siFia Seeker',
            updated_at: new Date().toISOString(),
          })
          .in('user_id', nonAdminMembers);

        if (memberDowngradeError) {
          Logger.error('Failed to downgrade family members', memberDowngradeError as Error, {
            component: 'FamilyPaymentService',
            familyGroupId,
          });
        }
      }

      // Step 2: Update family group status to cancelled
      const { error: groupUpdateError } = await supabase
        .from('family_subscription_groups')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', familyGroupId);

      if (groupUpdateError) {
        Logger.error('Failed to update family group status', groupUpdateError as Error, {
          component: 'FamilyPaymentService',
        });
      }

      // Step 3: Send notifications to all affected members
      const notificationPromises = nonAdminMembers.map(async (memberId) => {
        try {
          const message = reason === 'payment_failed'
            ? `The family subscription for "${familyGroup.group_name}" has been cancelled due to payment failure. Your account has been downgraded to Seeker tier.`
            : `The family subscription for "${familyGroup.group_name}" has been cancelled. Your account has been downgraded to Seeker tier.`;

          await FamilyNotificationService.notifyMemberRemoved(
            memberId,
            familyGroup.group_name
          );

          // Also create a general notification
          await supabase.from('notifications').insert({
            user_id: memberId,
            notification_type: 'family_cancelled',
            title: 'Family Subscription Ended',
            message,
            data: {
              family_group_id: familyGroupId,
              reason,
              cancelled_at: new Date().toISOString(),
            },
            is_read: false,
            created_at: new Date().toISOString(),
          });
        } catch (notifError) {
          Logger.error('Failed to notify member about cancellation', notifError as Error, {
            component: 'FamilyPaymentService',
            memberId,
          });
        }
      });

      await Promise.allSettled(notificationPromises);

      // Step 4: Log activity
      try {
        await supabase.from('family_activity_log').insert({
          family_group_id: familyGroupId,
          user_id: adminUserId,
          activity_type: 'subscription_cancelled',
          activity_description: `Family subscription cancelled - ${reason}. ${nonAdminMembers.length} members downgraded to Seeker tier.`,
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        Logger.error('Failed to log cancellation activity', logError as Error, {
          component: 'FamilyPaymentService',
        });
      }

      Logger.info('Family subscription cancelled successfully', {
        familyGroupId,
        membersAffected: nonAdminMembers.length,
        reason,
      });

      return {
        success: true,
        membersAffected: nonAdminMembers.length,
      };
    } catch (error) {
      Logger.error('Failed to cancel family subscription', error as Error, {
        component: 'FamilyPaymentService',
        familyGroupId,
      });
      return {
        success: false,
        membersAffected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate family subscription receipt
   */
  static async validateFamilyReceipt(
    receiptData: any,
    platform: PaymentPlatform
  ): Promise<{
    valid: boolean;
    productId?: string;
    expiryDate?: string;
    error?: string;
  }> {
    try {
      // Validate with platform
      const validationResult = await PlatformPaymentService.validateReceipt(
        receiptData,
        platform
      );

      if (!validationResult.valid) {
        throw new Error('Invalid receipt');
      }

      // Check if it's a family subscription product
      const familyProductIds = Object.values(this.getFamilyProductIds());
      const isFamilyProduct = familyProductIds.includes(validationResult.productId || '');

      if (!isFamilyProduct) {
        throw new Error('Not a family subscription product');
      }

      return {
        valid: true,
        productId: validationResult.productId,
        expiryDate: validationResult.expiryDate,
      };
    } catch (error) {
      Logger.error('Failed to validate family receipt', error as Error, {
        component: 'FamilyPaymentService',
      });

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Get family subscription status
   */
  static async getFamilySubscriptionStatus(_familyGroupId: string): Promise<{
    active: boolean;
    expiryDate?: string;
    autoRenew: boolean;
    billingCycle?: 'monthly' | 'annual';
  }> {
    // TODO: Implement status check with platform
    // For now, return mock data
    return {
      active: true,
      autoRenew: true,
      billingCycle: 'annual',
    };
  }
}

export default FamilyPaymentService;
