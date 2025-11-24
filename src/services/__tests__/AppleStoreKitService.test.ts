/**
 * AppleStoreKitService.test.ts
 * Test suite for Apple Store Kit payment service (critical payment component)
 */

import { AppleStoreKitService } from '../AppleStoreKitService';
import { NewSubscriptionService } from '../NewSubscriptionService';

// Mock StoreKit
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve()),
  endConnection: jest.fn(() => Promise.resolve()),
  getProducts: jest.fn(() => Promise.resolve([])),
  requestPurchase: jest.fn(() => Promise.resolve({})),
  finishTransaction: jest.fn(() => Promise.resolve()),
  validateReceiptIos: jest.fn(() => Promise.resolve({})),
}));

// Mock notification services
jest.mock('../notificationManagementService', () => ({
  notificationManagementService: {
    schedulePaymentSuccessNotification: jest.fn(),
  },
}));

jest.mock('../notificationAnalyticsService', () => ({
  notificationAnalyticsService: {
    trackPurchaseCompleted: jest.fn(),
    trackPurchaseFailed: jest.fn(),
  },
}));

// Mock subscription service
jest.mock('../NewSubscriptionService', () => ({
  NewSubscriptionService: {
    getUserSubscription: jest.fn(),
    updateUserSubscription: jest.fn(),
  },
}));

describe('AppleStoreKitService', () => {
  let service: AppleStoreKitService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppleStoreKitService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const { initConnection } = require('react-native-iap');
      initConnection.mockResolvedValue(true);

      await expect(service.initialize()).resolves.not.toThrow();
      expect(initConnection).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const { initConnection } = require('react-native-iap');
      initConnection.mockRejectedValue(new Error('StoreKit initialization failed'));

      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('product loading', () => {
    it('should load products successfully', async () => {
      const mockProducts = [
        {
          productId: 'com.sifia.spark.monthly',
          price: '9.99',
          currency: 'USD',
          localizedPrice: '$9.99',
          title: 'Spark Monthly',
          description: 'Spark subscription plan',
        },
      ];

      const { getProducts } = require('react-native-iap');
      getProducts.mockResolvedValue(mockProducts);

      const products = await service.getProducts(['com.sifia.spark.monthly']);

      expect(products).toEqual(mockProducts);
      expect(getProducts).toHaveBeenCalledWith(['com.sifia.spark.monthly']);
    });

    it('should handle product loading errors', async () => {
      const { getProducts } = require('react-native-iap');
      getProducts.mockRejectedValue(new Error('Failed to load products'));

      const products = await service.getProducts(['com.sifia.spark.monthly']);

      expect(products).toEqual([]);
    });

    it('should handle empty product list', async () => {
      const { getProducts } = require('react-native-iap');
      getProducts.mockResolvedValue([]);

      const products = await service.getProducts(['invalid.product.id']);

      expect(products).toEqual([]);
    });
  });

  describe('purchase processing', () => {
    it('should process purchase successfully', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const mockPurchase = {
        productId,
        transactionId: 'trans-123',
        transactionDate: Date.now().toString(),
        transactionReceipt: 'receipt-data',
      };

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockResolvedValue(mockPurchase);

      const mockSubscription = {
        subscription_display_name: 'Spark Monthly',
        tier: 'spark',
      };

      (NewSubscriptionService.getUserSubscription as jest.Mock).mockResolvedValue(mockSubscription);
      (NewSubscriptionService.updateUserSubscription as jest.Mock).mockResolvedValue(true);

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(true);
      expect(requestPurchase).toHaveBeenCalledWith(productId);
      expect(NewSubscriptionService.updateUserSubscription).toHaveBeenCalled();
    });

    it('should handle purchase cancellation', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockRejectedValue(new Error('User cancelled'));

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('cancelled');
    });

    it('should handle purchase errors', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockRejectedValue(new Error('Payment failed'));

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Payment failed');
    });
  });

  describe('receipt validation', () => {
    it('should validate receipt successfully', async () => {
      const receipt = 'receipt-data';
      const userId = 'user-123';

      const { validateReceiptIos } = require('react-native-iap');
      validateReceiptIos.mockResolvedValue({
        valid: true,
        data: { productId: 'com.sifia.spark.monthly' },
      });

      const result = await service.validateReceipt(receipt, userId);

      expect(result.valid).toBe(true);
      expect(validateReceiptIos).toHaveBeenCalledWith(receipt, expect.any(Object));
    });

    it('should handle invalid receipt', async () => {
      const receipt = 'invalid-receipt';
      const userId = 'user-123';

      const { validateReceiptIos } = require('react-native-iap');
      validateReceiptIos.mockResolvedValue({
        valid: false,
        data: null,
      });

      const result = await service.validateReceipt(receipt, userId);

      expect(result.valid).toBe(false);
    });

    it('should handle receipt validation errors', async () => {
      const receipt = 'receipt-data';
      const userId = 'user-123';

      const { validateReceiptIos } = require('react-native-iap');
      validateReceiptIos.mockRejectedValue(new Error('Validation failed'));

      const result = await service.validateReceipt(receipt, userId);

      expect(result.valid).toBe(false);
    });
  });

  describe('subscription management', () => {
    it('should handle subscription upgrade', async () => {
      const userId = 'user-123';
      const newTier = 'growth';

      const mockSubscription = {
        subscription_display_name: 'Spark Monthly',
        tier: 'spark',
      };

      (NewSubscriptionService.getUserSubscription as jest.Mock).mockResolvedValue(mockSubscription);
      (NewSubscriptionService.updateUserSubscription as jest.Mock).mockResolvedValue(true);

      const result = await service.upgradeSubscription(userId, newTier);

      expect(result.success).toBe(true);
      expect(NewSubscriptionService.updateUserSubscription).toHaveBeenCalledWith(userId, newTier);
    });

    it('should handle subscription downgrade', async () => {
      const userId = 'user-123';
      const newTier = 'spark';

      const mockSubscription = {
        subscription_display_name: 'Growth Monthly',
        tier: 'growth',
      };

      (NewSubscriptionService.getUserSubscription as jest.Mock).mockResolvedValue(mockSubscription);
      (NewSubscriptionService.updateUserSubscription as jest.Mock).mockResolvedValue(true);

      const result = await service.downgradeSubscription(userId, newTier);

      expect(result.success).toBe(true);
      expect(NewSubscriptionService.updateUserSubscription).toHaveBeenCalledWith(userId, newTier);
    });

    it('should handle subscription cancellation', async () => {
      const userId = 'user-123';

      (NewSubscriptionService.updateUserSubscription as jest.Mock).mockResolvedValue(true);

      const result = await service.cancelSubscription(userId);

      expect(result.success).toBe(true);
      expect(NewSubscriptionService.updateUserSubscription).toHaveBeenCalledWith(userId, 'free');
    });
  });

  describe('transaction management', () => {
    it('should finish transaction successfully', async () => {
      const transactionId = 'trans-123';

      const { finishTransaction } = require('react-native-iap');
      finishTransaction.mockResolvedValue(true);

      await expect(service.finishTransaction(transactionId)).resolves.not.toThrow();
      expect(finishTransaction).toHaveBeenCalledWith(transactionId, false);
    });

    it('should handle transaction finish errors', async () => {
      const transactionId = 'trans-123';

      const { finishTransaction } = require('react-native-iap');
      finishTransaction.mockRejectedValue(new Error('Failed to finish transaction'));

      await expect(service.finishTransaction(transactionId)).resolves.not.toThrow();
    });
  });

  describe('pricing information', () => {
    it('should get pricing for products', async () => {
      const mockProducts = [
        {
          productId: 'com.sifia.spark.monthly',
          price: '9.99',
          currency: 'USD',
          localizedPrice: '$9.99',
        },
        {
          productId: 'com.sifia.growth.monthly',
          price: '19.99',
          currency: 'USD',
          localizedPrice: '$19.99',
        },
      ];

      const { getProducts } = require('react-native-iap');
      getProducts.mockResolvedValue(mockProducts);

      const pricing = await service.getPricing([
        'com.sifia.spark.monthly',
        'com.sifia.growth.monthly',
      ]);

      expect(pricing).toEqual({
        'com.sifia.spark.monthly': {
          price: '9.99',
          currency: 'USD',
          localizedPrice: '$9.99',
        },
        'com.sifia.growth.monthly': {
          price: '19.99',
          currency: 'USD',
          localizedPrice: '$19.99',
        },
      });
    });

    it('should handle missing pricing data', async () => {
      const { getProducts } = require('react-native-iap');
      getProducts.mockResolvedValue([]);

      const pricing = await service.getPricing(['com.sifia.spark.monthly']);

      expect(pricing).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockRejectedValue(new Error('Network error'));

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle invalid user ID', async () => {
      const userId = '';
      const productId = 'com.sifia.spark.monthly';

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle invalid product ID', async () => {
      const userId = 'user-123';
      const productId = '';

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid product ID');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      const { endConnection } = require('react-native-iap');
      endConnection.mockResolvedValue(true);

      await expect(service.cleanup()).resolves.not.toThrow();
      expect(endConnection).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const { endConnection } = require('react-native-iap');
      endConnection.mockRejectedValue(new Error('Cleanup failed'));

      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple concurrent purchases', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockResolvedValue({
        productId,
        transactionId: 'trans-123',
      });

      // Start multiple purchases concurrently
      const purchases = Array.from({ length: 3 }, () =>
        service.purchaseProduct(userId, productId)
      );

      const results = await Promise.all(purchases);

      // All should complete without errors
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle malformed purchase data', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockResolvedValue({
        // Missing required fields
        productId: productId,
      });

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
    });

    it('should handle subscription service errors', async () => {
      const userId = 'user-123';
      const productId = 'com.sifia.spark.monthly';

      const { requestPurchase } = require('react-native-iap');
      requestPurchase.mockResolvedValue({
        productId,
        transactionId: 'trans-123',
      });

      (NewSubscriptionService.updateUserSubscription as jest.Mock).mockRejectedValue(
        new Error('Subscription service error')
      );

      const result = await service.purchaseProduct(userId, productId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Subscription service error');
    });
  });
});
