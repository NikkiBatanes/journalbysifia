import { Platform } from 'react-native';
import { PlatformPaymentService } from '../../services/PlatformPaymentService';
import { AppleStoreKitService } from '../../services/AppleStoreKitService';
import { GooglePlayBillingService } from '../../services/GooglePlayBillingService';
import { NewSubscriptionService } from '../../services/NewSubscriptionService';

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios', // Default to iOS for tests
  },
}));

// Mock services
jest.mock('../../services/AppleStoreKitService');
jest.mock('../../services/GooglePlayBillingService');
jest.mock('../../services/NewSubscriptionService');

const mockAppleService = AppleStoreKitService as jest.Mocked<typeof AppleStoreKitService>;
const mockGoogleService = GooglePlayBillingService as jest.Mocked<typeof GooglePlayBillingService>;
const mockNewSubscriptionService = NewSubscriptionService as jest.Mocked<typeof NewSubscriptionService>;

describe('PlatformPaymentService', () => {
  let paymentService: PlatformPaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = PlatformPaymentService.getInstance();
    
    // Mock getInstance methods
    mockAppleService.getInstance = jest.fn().mockReturnValue({
      initialize: jest.fn(),
      getAvailableProducts: jest.fn(),
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
      getCurrentSubscriptionStatus: jest.fn(),
      cleanup: jest.fn(),
    });

    mockGoogleService.getInstance = jest.fn().mockReturnValue({
      initialize: jest.fn(),
      getAvailableProducts: jest.fn(),
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
      getCurrentSubscriptionStatus: jest.fn(),
      cancelSubscription: jest.fn(),
      cleanup: jest.fn(),
    });
  });

  describe('initialize', () => {
    it('should initialize Apple service on iOS', async () => {
      (Platform as any).OS = 'ios';
      const mockAppleInstance = mockAppleService.getInstance();
      mockAppleInstance.initialize = jest.fn().mockResolvedValue(true);

      const result = await paymentService.initialize();

      expect(mockAppleInstance.initialize).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should initialize Google service on Android', async () => {
      (Platform as any).OS = 'android';
      const mockGoogleInstance = mockGoogleService.getInstance();
      mockGoogleInstance.initialize = jest.fn().mockResolvedValue(true);

      const result = await paymentService.initialize();

      expect(mockGoogleInstance.initialize).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for unsupported platform', async () => {
      (Platform as any).OS = 'web';

      const result = await paymentService.initialize();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableProducts', () => {
    it('should get products from Apple service on iOS', async () => {
      (Platform as any).OS = 'ios';
      const mockProducts = [
        {
          productId: 'com.yourcompany.sifia.spark.monthly',
          price: '9.99',
          currency: 'USD',
          localizedPrice: '$9.99',
          title: 'Spark Monthly',
          description: 'Spark subscription',
        },
      ];

      const mockAppleInstance = mockAppleService.getInstance();
      mockAppleInstance.getAvailableProducts = jest.fn().mockResolvedValue(mockProducts);

      const result = await paymentService.getAvailableProducts();

      expect(result).toEqual([
        {
          ...mockProducts[0],
          tier: 'spark',
        },
      ]);
    });

    it('should get products from Google service on Android', async () => {
      (Platform as any).OS = 'android';
      const mockProducts = [
        {
          productId: 'com.yourcompany.sifia.growth.monthly',
          price: '19.99',
          currency: 'USD',
          localizedPrice: '$19.99',
          title: 'Growth Monthly',
          description: 'Growth subscription',
        },
      ];

      const mockGoogleInstance = mockGoogleService.getInstance();
      mockGoogleInstance.getAvailableProducts = jest.fn().mockResolvedValue(mockProducts);

      const result = await paymentService.getAvailableProducts();

      expect(result).toEqual([
        {
          ...mockProducts[0],
          tier: 'growth',
        },
      ]);
    });
  });

  describe('purchaseSubscription', () => {
    it('should purchase through Apple service on iOS', async () => {
      (Platform as any).OS = 'ios';
      const mockResult = {
        success: true,
        transactionId: 'txn-123',
      };

      const mockAppleInstance = mockAppleService.getInstance();
      mockAppleInstance.purchaseSubscription = jest.fn().mockResolvedValue(mockResult);

      const result = await paymentService.purchaseSubscription('spark-product', 'user-123');

      expect(mockAppleInstance.purchaseSubscription).toHaveBeenCalledWith('spark-product', 'user-123');
      expect(result).toEqual(mockResult);
    });

    it('should purchase through Google service on Android', async () => {
      (Platform as any).OS = 'android';
      const mockResult = {
        success: true,
        transactionId: 'txn-456',
      };

      const mockGoogleInstance = mockGoogleService.getInstance();
      mockGoogleInstance.purchaseSubscription = jest.fn().mockResolvedValue(mockResult);

      const result = await paymentService.purchaseSubscription('growth-product', 'user-123');

      expect(mockGoogleInstance.purchaseSubscription).toHaveBeenCalledWith('growth-product', 'user-123');
      expect(result).toEqual(mockResult);
    });

    it('should handle unsupported platform', async () => {
      (Platform as any).OS = 'web';

      const result = await paymentService.purchaseSubscription('product', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported platform for purchases');
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should get status from database and platform service', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'spark',
        status: 'active',
        subscription_end_date: '2024-12-31',
        platform: 'apple',
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);

      (Platform as any).OS = 'ios';
      const mockAppleInstance = mockAppleService.getInstance();
      mockAppleInstance.getCurrentSubscriptionStatus = jest.fn().mockResolvedValue({
        isActive: true,
        tier: 'spark',
        expiryDate: '2024-12-31',
      });

      const result = await paymentService.getSubscriptionStatus('user-123');

      expect(result).toEqual({
        isActive: true,
        tier: 'spark',
        expiryDate: '2024-12-31',
        platform: 'apple',
      });
    });

    it('should return null if no subscription exists', async () => {
      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(null as any);

      const result = await paymentService.getSubscriptionStatus('user-123');

      expect(result).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription and update database', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'spark',
        status: 'active',
        platform: 'apple',
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);
      mockNewSubscriptionService.cancelSubscription.mockResolvedValue(undefined);

      const result = await paymentService.cancelSubscription('user-123');

      expect(mockNewSubscriptionService.cancelSubscription).toHaveBeenCalledWith('user-123');
      expect(result).toBe(true);
    });

    it('should handle cancellation for Google Play', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'growth',
        status: 'active',
        platform: 'google',
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);
      mockNewSubscriptionService.cancelSubscription.mockResolvedValue(undefined);

      (Platform as any).OS = 'android';
      const mockGoogleInstance = mockGoogleService.getInstance();
      mockGoogleInstance.cancelSubscription = jest.fn().mockResolvedValue(undefined);

      const result = await paymentService.cancelSubscription('user-123');

      expect(mockGoogleInstance.cancelSubscription).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getProductPricing', () => {
    it('should return pricing map for all tiers', async () => {
      const mockProducts = [
        { tier: 'spark', localizedPrice: '$9.99' },
        { tier: 'growth', localizedPrice: '$19.99' },
        { tier: 'transformation', localizedPrice: '$39.99' },
      ];

      jest.spyOn(paymentService, 'getAvailableProducts').mockResolvedValue(mockProducts as any);

      const result = await paymentService.getProductPricing();

      expect(result).toEqual({
        spark: '$9.99',
        growth: '$19.99',
        transformation: '$39.99',
      });
    });
  });

  describe('restorePurchases', () => {
    it('should restore purchases through Apple service on iOS', async () => {
      (Platform as any).OS = 'ios';
      const mockAppleInstance = mockAppleService.getInstance();
      mockAppleInstance.restorePurchases = jest.fn().mockResolvedValue(true);

      const result = await paymentService.restorePurchases('user-123');

      expect(mockAppleInstance.restorePurchases).toHaveBeenCalledWith('user-123');
      expect(result).toBe(true);
    });

    it('should restore purchases through Google service on Android', async () => {
      (Platform as any).OS = 'android';
      const mockGoogleInstance = mockGoogleService.getInstance();
      mockGoogleInstance.restorePurchases = jest.fn().mockResolvedValue(true);

      const result = await paymentService.restorePurchases('user-123');

      expect(mockGoogleInstance.restorePurchases).toHaveBeenCalledWith('user-123');
      expect(result).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup both services', async () => {
      const mockAppleInstance = mockAppleService.getInstance();
      const mockGoogleInstance = mockGoogleService.getInstance();
      
      mockAppleInstance.cleanup = jest.fn().mockResolvedValue(undefined);
      mockGoogleInstance.cleanup = jest.fn().mockResolvedValue(undefined);

      await paymentService.cleanup();

      expect(mockAppleInstance.cleanup).toHaveBeenCalled();
      expect(mockGoogleInstance.cleanup).toHaveBeenCalled();
    });
  });
});
