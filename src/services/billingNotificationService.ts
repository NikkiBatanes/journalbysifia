/**
 * BillingNotificationService.ts
 * Handles billing-related notifications for subscription events
 */

import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NewSubscriptionService } from './NewSubscriptionService';

export interface BillingEvent {
  type: 'payment_failed' | 'grace_period' | 'payment_successful' | 'subscription_cancelled' | 'renewal_reminder' | 'subscription_renewed';
  userId: string;
  data?: any;
}

class BillingNotificationService {
  private static instance: BillingNotificationService;

  static getInstance(): BillingNotificationService {
    if (!BillingNotificationService.instance) {
      BillingNotificationService.instance = new BillingNotificationService();
    }
    return BillingNotificationService.instance;
  }

  /**
   * Handle payment failure and send notification
   */
  async handlePaymentFailure(userId: string, failureReason?: string): Promise<void> {
    try {
      Logger.info('Handling payment failure', {
        component: 'billingNotificationService',
        userId,
        failureReason,
      });

      // Schedule immediate payment failure notification
      await notificationSchedulerService.schedulePaymentFailureNotification(userId, failureReason);

      // Check if user is in grace period and schedule grace period notification
      const subscription = await NewSubscriptionService.getUserSubscription(userId);
      if ((subscription.status as string) === 'grace_period' && subscription.subscription_end_date) {
        const gracePeriodEnds = new Date(subscription.subscription_end_date);
        await notificationSchedulerService.scheduleGracePeriodNotification(userId, gracePeriodEnds);
      }

    } catch (error) {
      Logger.error('Failed to handle payment failure', error as Error, {
        component: 'billingNotificationService',
        userId,
      });
    }
  }

  /**
   * Handle successful payment and send notification
   */
  async handlePaymentSuccess(userId: string, newTier: string, amount: number): Promise<void> {
    try {
      Logger.info('Handling payment success', {
        component: 'billingNotificationService',
        userId,
        newTier,
        amount,
      });

      // Schedule payment success notification
      await notificationSchedulerService.schedulePaymentSuccessNotification(userId, newTier, amount);

      // Schedule renewal reminder for next billing cycle
      const subscription = await NewSubscriptionService.getUserSubscription(userId);
      if (subscription.subscription_end_date) {
        const renewalDate = new Date(subscription.subscription_end_date);
        await notificationSchedulerService.scheduleSubscriptionRenewalNotification(userId, newTier);
      }

    } catch (error) {
      Logger.error('Failed to handle payment success', error as Error, {
        component: 'billingNotificationService',
        userId,
      });
    }
  }

  /**
   * Handle subscription cancellation and send notification
   */
  async handleSubscriptionCancellation(userId: string): Promise<void> {
    try {
      Logger.info('Handling subscription cancellation', {
        component: 'billingNotificationService',
        userId,
      });

      const subscription = await NewSubscriptionService.getUserSubscription(userId);
      if (subscription.subscription_end_date) {
        const endDate = new Date(subscription.subscription_end_date);
        await notificationSchedulerService.scheduleSubscriptionCancelledNotification(userId, endDate);
      }

    } catch (error) {
      Logger.error('Failed to handle subscription cancellation', error as Error, {
        component: 'billingNotificationService',
        userId,
      });
    }
  }

  /**
   * Schedule renewal reminder for active subscription
   */
  async scheduleRenewalReminder(userId: string): Promise<void> {
    try {
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (subscription.status === 'active' && subscription.subscription_end_date) {
        const renewalDate = new Date(subscription.subscription_end_date);
        const tierDisplayName = subscription.subscription_display_name || subscription.tier;

        await notificationSchedulerService.scheduleSubscriptionRenewalNotification(
          userId,
          tierDisplayName
        );

        Logger.info('Renewal reminder scheduled', {
          component: 'billingNotificationService',
          userId,
          renewalDate: renewalDate.toISOString(),
          tier: tierDisplayName,
        });
      }

    } catch (error) {
      Logger.error('Failed to schedule renewal reminder', error as Error, {
        component: 'billingNotificationService',
        userId,
      });
    }
  }

  /**
   * Handle successful subscription renewal (plan replenishment) and notify the user.
   */
  async handleSubscriptionRenewal(userId: string, tier: string): Promise<void> {
    try {
      Logger.info('Handling subscription renewal notification', {
        component: 'billingNotificationService',
        userId,
        tier,
      });

      await notificationSchedulerService.scheduleSubscriptionRenewalNotification(userId, tier);
    } catch (error) {
      Logger.error('Failed to send subscription renewal notification', error as Error, {
        component: 'billingNotificationService',
        userId,
      });
    }
  }

  /**
   * Handle trial expiry and schedule notifications
   */
  async handleTrialExpiry(userId: string, expiryDate: Date): Promise<void> {
    try {
      Logger.info('Handling trial expiry', {
        component: 'billingNotificationService',
        userId,
        expiryDate: expiryDate.toISOString(),
      });

      await notificationSchedulerService.scheduleTrialExpiringNotification(userId, expiryDate);

    } catch (error) {
      Logger.error('Failed to handle trial expiry', error as Error, {
        component: 'billingNotificationService',
        userId,
      });
    }
  }

  /**
   * Process billing events from webhook or app events
   */
  async processBillingEvent(event: BillingEvent): Promise<void> {
    try {
      Logger.info('Processing billing event', {
        component: 'billingNotificationService',
        eventType: event.type,
        userId: event.userId,
      });

      switch (event.type) {
        case 'payment_failed':
          await this.handlePaymentFailure(event.userId, event.data?.failureReason);
          break;

        case 'grace_period':
          if (event.data?.gracePeriodEnds) {
            await notificationSchedulerService.scheduleGracePeriodNotification(
              event.userId,
              new Date(event.data.gracePeriodEnds)
            );
          }
          break;

        case 'payment_successful':
          await this.handlePaymentSuccess(
            event.userId,
            event.data?.newTier,
            event.data?.amount
          );
          break;

        case 'subscription_cancelled':
          await this.handleSubscriptionCancellation(event.userId);
          break;

        case 'renewal_reminder':
          await this.scheduleRenewalReminder(event.userId);
          break;

        case 'subscription_renewed':
          await this.handleSubscriptionRenewal(event.userId, event.data?.tier || 'your plan');
          break;

        default:
          Logger.warn('Unknown billing event type', {
            component: 'billingNotificationService',
            eventType: event.type,
          });
      }

    } catch (error) {
      Logger.error('Failed to process billing event', error as Error, {
        component: 'billingNotificationService',
        eventType: event.type,
        userId: event.userId,
      });
    }
  }
}

export const billingNotificationService = BillingNotificationService.getInstance();
