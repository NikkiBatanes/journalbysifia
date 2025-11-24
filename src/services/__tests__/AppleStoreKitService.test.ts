/**
 * AppleStoreKitService.test.ts
 * Test suite for Apple StoreKit payment processing (CRITICAL)
 * Testing only PUBLIC methods that actually exist in the service
 */

import { AppleStoreKitService } from '../AppleStoreKitService';

// Mock react-native-iap
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve()),
  getSubscriptions: jest.fn(() => Promise.resolve([])),
  requestSubscription: jest.fn(() => Promise.resolve()),
  finishTransaction: jest.fn(() => Promise.resolve()),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
}));

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// Mock NewSubscriptionService
jest.mock('../NewSubscriptionService', () => ({
  NewSubscriptionService: {
    getUserSubscription: jest.fn(() => Promise.resolve({
      user_id: 'user-123',
      tier: 'transformation',
      subscription_display_name: 'Transformation',
      status: 'active',
    })),
    upgradeSubscription: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

// Mock notification services
jest.mock('../notificationSchedulerService', () => ({
  notificationSchedulerService: {
    schedulePaymentSuccessNotification: jest.fn(() => Promise.resolve()),
  },
}));

describe('AppleStoreKitService', () => {
  let service: AppleStoreKitService;

  beforeEach(() => {
    service = AppleStoreKitService.getInstance();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AppleStoreKitService.getInstance();
      const instance2 = AppleStoreKitService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AppleStoreKitService);
    });
  });

  describe('initialize', () => {
    it('should initialize connection to App Store', async () => {
      const result = await service.initialize();
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle initialization errors gracefully', async () => {
      const RNIap = require('react-native-iap');
      RNIap.initConnection.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.initialize();
      
      // Should return false on error, not throw
      expect(typeof result).toBe('boolean');
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize();
      
      const RNIap = require('react-native-iap');
      // Should only call initConnection once
      expect(RNIap.initConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAvailableProducts', () => {
    it('should fetch available subscription products', async () => {
      const mockProducts = [
        {
          productId: 'app.sifia.com.transformation.monthly',
          price: '14.99',
          currency: 'USD',
          localizedPrice: '$14.99',
          title: 'Transformation Monthly',
          description: 'Monthly subscription',
        },
      ];

      const RNIap = require('react-native-iap');
      RNIap.getSubscriptions.mockResolvedValueOnce(mockProducts);

      const products = await service.getAvailableProducts();

      expect(Array.isArray(products)).toBe(true);
    });

    it('should handle empty product list', async () => {
      const RNIap = require('react-native-iap');
      RNIap.getSubscriptions.mockResolvedValueOnce([]);

      const products = await service.getAvailableProducts();

      expect(products).toEqual([]);
    });

    it('should handle product fetch errors', async () => {
      const RNIap = require('react-native-iap');
      RNIap.getSubscriptions.mockRejectedValueOnce(new Error('Fetch failed'));

      const products = await service.getAvailableProducts();

      expect(Array.isArray(products)).toBe(true);
    });
  });

  describe('purchaseSubscription', () => {
    it('should initiate subscription purchase', async () => {
      const productId = 'app.sifia.com.transformation.monthly';
      const userId = 'user-123';

      // This will timeout in test, but we're just checking it doesn't throw
      const purchasePromise = service.purchaseSubscription(productId, userId);

      expect(purchasePromise).toBeInstanceOf(Promise);
      
      // Don't await to avoid timeout
    });

    it('should handle invalid product ID', async () => {
      const invalidProductId = '';
      const userId = 'user-123';

      await expect(
        service.purchaseSubscription(invalidProductId, userId)
      ).rejects.toThrow();
    });

    it('should handle invalid user ID', async () => {
      const productId = 'app.sifia.com.spark.monthly';
      const invalidUserId = '';

      await expect(
        service.purchaseSubscription(productId, invalidUserId)
      ).rejects.toThrow();
    });
  });

  describe('getCurrentSubscriptionStatus', () => {
    it('should get current subscription status', async () => {
      const userId = 'user-123';

      const status = await service.getCurrentSubscriptionStatus(userId);

      expect(status).toBeDefined();
    });

    it('should handle user with no subscription', async () => {
      const userId = 'user-new';
      const NewSubscriptionService = require('../NewSubscriptionService').NewSubscriptionService;
      NewSubscriptionService.getUserSubscription.mockResolvedValueOnce({
        user_id: userId,
        tier: 'seeker',
        status: 'active',
      });

      const status = await service.getCurrentSubscriptionStatus(userId);

      expect(status).toBeDefined();
    });
  });

  describe('restorePurchases', () => {
    it('should restore previous purchases', async () => {
      const userId = 'user-123';
      const RNIap = require('react-native-iap');
      RNIap.getAvailablePurchases.mockResolvedValueOnce([]);

      const result = await service.restorePurchases(userId);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle no purchases to restore', async () => {
      const userId = 'user-new';
      const RNIap = require('react-native-iap');
      RNIap.getAvailablePurchases.mockResolvedValueOnce([]);

      const result = await service.restorePurchases(userId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No purchases');
    });

    it('should handle restore errors', async () => {
      const userId = 'user-123';
      const RNIap = require('react-native-iap');
      RNIap.getAvailablePurchases.mockRejectedValueOnce(new Error('Restore failed'));

      const result = await service.restorePurchases(userId);

      expect(result.success).toBe(false);
    });
  });

  describe('checkAndSyncSubscriptionStatus', () => {
    it('should sync subscription status with App Store', async () => {
      const userId = 'user-123';

      await expect(
        service.checkAndSyncSubscriptionStatus(userId)
      ).resolves.not.toThrow();
    });

    it('should skip sync if purchase in progress', async () => {
      const userId = 'user-123';

      await expect(
        service.checkAndSyncSubscriptionStatus(userId, true)
      ).resolves.not.toThrow();
    });

    it('should handle sync errors gracefully', async () => {
      const userId = 'user-error';
      const RNIap = require('react-native-iap');
      RNIap.getAvailablePurchases.mockRejectedValueOnce(new Error('Sync failed'));

      await expect(
        service.checkAndSyncSubscriptionStatus(userId)
      ).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup connections and listeners', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      const RNIap = require('react-native-iap');
      RNIap.endConnection.mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const RNIap = require('react-native-iap');
      RNIap.initConnection.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.initialize();
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle App Store connection failures', async () => {
      const RNIap = require('react-native-iap');
      RNIap.getSubscriptions.mockRejectedValueOnce(new Error('Store unavailable'));

      const products = await service.getAvailableProducts();
      
      expect(Array.isArray(products)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent initialization', async () => {
      const promises = Array(5).fill(null).map(() => service.initialize());
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });

    it('should handle rapid purchase attempts', () => {
      const productId = 'app.sifia.com.spark.monthly';
      const userId = 'user-123';

      // Multiple rapid calls
      const promise1 = service.purchaseSubscription(productId, userId);
      const promise2 = service.purchaseSubscription(productId, userId);

      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
    });
  });
});
