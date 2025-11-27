/**
 * Subscription Sync Utility
 *
 * This utility helps manually sync subscription status when payment validation
 * might have failed or when the user's account tier doesn't reflect their purchase.
 */

import { AppleStoreKitService } from '../services/AppleStoreKitService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { getAvailablePurchases, ProductPurchase } from 'react-native-iap';

export class SubscriptionSync {
  /**
   * Force sync subscription status with Apple
   * This should be called when user reports payment issues
   */
  static async forceSyncSubscription(userId: string): Promise<{
    success: boolean;
    message: string;
    previousTier?: string;
    newTier?: string;
  }> {
    try {
      Logger.info('[SubscriptionSync] Starting force sync', {
        userId: userId.substring(0, 10) + '...',
      });

      // Get current subscription before sync
      const previousSub = await NewSubscriptionService.getUserSubscription(userId);
      const previousTier = previousSub.tier;

      // Force sync with Apple (skip purchase in progress check)
      const storeKitService = AppleStoreKitService.getInstance();
      await storeKitService.checkAndSyncSubscriptionStatus(userId, false);

      // Get updated subscription
      const newSub = await NewSubscriptionService.getUserSubscription(userId);
      const newTier = newSub.tier;

      const tierChanged = previousTier !== newTier;

      Logger.info('[SubscriptionSync] Sync completed', {
        userId: userId.substring(0, 10) + '...',
        previousTier,
        newTier,
        tierChanged,
      });

      return {
        success: true,
        message: tierChanged
          ? `Successfully updated from ${previousTier} to ${newTier}`
          : `No changes needed. Current tier: ${newTier}`,
        previousTier,
        newTier,
      };
    } catch (error) {
      Logger.error('[SubscriptionSync] Force sync failed', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown sync error',
      };
    }
  }

  /**
   * Check for any unprocessed purchases
   */
  static async checkForUnprocessedPurchases(userId: string): Promise<{
    hasUnprocessed: boolean;
    purchases: any[];
  }> {
    try {
      const storeKitService = AppleStoreKitService.getInstance();
      await storeKitService.initialize();

      // Get available purchases from Apple
      const availablePurchases = await getAvailablePurchases();

      Logger.info('[SubscriptionSync] Checking for unprocessed purchases', {
        userId: userId.substring(0, 10) + '...',
        availablePurchases: availablePurchases.length,
      });

      return {
        hasUnprocessed: availablePurchases.length > 0,
        purchases: availablePurchases,
      };
    } catch (error) {
      Logger.error('[SubscriptionSync] Failed to check unprocessed purchases', error as Error);
      return {
        hasUnprocessed: false,
        purchases: [],
      };
    }
  }

  /**
   * Manually validate and process a specific purchase
   */
  static async manuallyProcessPurchase(
    userId: string,
    purchaseTransactionId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const storeKitService = AppleStoreKitService.getInstance();
      await storeKitService.initialize();

      // Get all available purchases and find the specific one
      const availablePurchases = await getAvailablePurchases();

      const targetPurchase = availablePurchases.find(
        (p: ProductPurchase) => p.transactionId === purchaseTransactionId
      );

      if (!targetPurchase) {
        return {
          success: false,
          message: `Purchase with transaction ID ${purchaseTransactionId} not found`,
        };
      }

      Logger.info('[SubscriptionSync] Manually processing purchase', {
        userId: userId.substring(0, 10) + '...',
        productId: targetPurchase.productId,
        transactionId: targetPurchase.transactionId,
      });

      // Manually trigger the purchase update handler
      await (storeKitService as any).handlePurchaseUpdate(targetPurchase);

      return {
        success: true,
        message: 'Purchase processed successfully',
      };
    } catch (error) {
      Logger.error('[SubscriptionSync] Manual purchase processing failed', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  /**
   * Get subscription status for debugging
   */
  static async getDebugInfo(userId: string): Promise<{
    currentSubscription: any;
    recentPurchases: any[];
    validationLogs: any[];
  }> {
    try {
      const currentSubscription = await NewSubscriptionService.getUserSubscription(userId);

      const storeKitService = AppleStoreKitService.getInstance();
      await storeKitService.initialize();

      const recentPurchases = await getAvailablePurchases();

      // Get recent validation logs from database (if available)
      const { data: validationLogs } = await supabase
        .from('validated_receipts')
        .select('*')
        .eq('user_id', userId)
        .order('validated_at', { ascending: false })
        .limit(5);

      return {
        currentSubscription,
        recentPurchases,
        validationLogs: validationLogs || [],
      };
    } catch (error) {
      Logger.error('[SubscriptionSync] Failed to get debug info', error as Error);
      return {
        currentSubscription: null,
        recentPurchases: [],
        validationLogs: [],
      };
    }
  }
}

export default SubscriptionSync;
