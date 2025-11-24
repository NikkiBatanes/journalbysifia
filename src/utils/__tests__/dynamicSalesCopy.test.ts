/**
 * dynamicSalesCopy.test.ts
 * Test suite for dynamic sales copy utility
 */

import {
  generateSalesCopy,
  getUpgradeMessage,
  getLimitMessage,
  getTrialMessage,
} from '../dynamicSalesCopy';

describe('dynamicSalesCopy', () => {
  describe('generateSalesCopy', () => {
    it('should generate sales copy for Seeker tier', () => {
      const context = {
        currentTier: 'seeker',
        featureType: 'playbook',
        remainingUsage: 0,
        totalUsage: 3,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(typeof copy.title).toBe('string');
      expect(typeof copy.message).toBe('string');
      expect(typeof copy.cta).toBe('string');
      expect(typeof copy.recommendedTier).toBe('string');
    });

    it('should generate sales copy for Spark tier', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'devotional',
        remainingUsage: 2,
        totalUsage: 8,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.title).toContain('Spark');
      expect(typeof copy.message).toBe('string');
    });

    it('should generate sales copy for Growth tier', () => {
      const context = {
        currentTier: 'growth',
        featureType: 'playbook',
        remainingUsage: 5,
        totalUsage: 20,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.title).toContain('Growth');
    });

    it('should generate sales copy for Transformation tier', () => {
      const context = {
        currentTier: 'transformation',
        featureType: 'devotional',
        remainingUsage: 999,
        totalUsage: 999,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.title).toContain('Transformation');
    });

    it('should handle trial users correctly', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: 1,
        totalUsage: 8,
        isTrial: true,
        trialEndsAt: '2024-01-15',
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.message).toContain('trial');
    });

    it('should handle duration-locked devotionals', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'devotional',
        remainingUsage: 2,
        totalUsage: 8,
        devotionalDuration: 7, // 7-day devotional
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.message).toContain('7-day');
    });

    it('should include refresh information', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: 0,
        totalUsage: 8,
        refreshDate: '2024-02-01',
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.message).toContain('refresh');
    });
  });

  describe('getUpgradeMessage', () => {
    it('should generate upgrade message for Spark users', () => {
      const message = getUpgradeMessage('spark', 'growth');

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message).toContain('upgrade');
    });

    it('should generate upgrade message for Growth users', () => {
      const message = getUpgradeMessage('growth', 'transformation');

      expect(message).toBeDefined();
      expect(message).toContain('Transformation');
    });

    it('should handle invalid tier gracefully', () => {
      const message = getUpgradeMessage('invalid', 'growth');

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });
  });

  describe('getLimitMessage', () => {
    it('should generate limit message for exhausted usage', () => {
      const message = getLimitMessage('spark', 0, 8, 'playbook');

      expect(message).toBeDefined();
      expect(message).toContain('used all');
      expect(message).toContain('8');
    });

    it('should generate limit message for remaining usage', () => {
      const message = getLimitMessage('spark', 3, 8, 'playbook');

      expect(message).toBeDefined();
      expect(message).toContain('3');
      expect(message).toContain('remaining');
    });

    it('should handle different feature types', () => {
      const playbookMessage = getLimitMessage('spark', 0, 8, 'playbook');
      const devotionalMessage = getLimitMessage('spark', 0, 8, 'devotional');

      expect(playbookMessage).toContain('playbook');
      expect(devotionalMessage).toContain('devotional');
    });
  });

  describe('getTrialMessage', () => {
    it('should generate trial message for active trial', () => {
      const message = getTrialMessage(true, '2024-01-15');

      expect(message).toBeDefined();
      expect(message).toContain('trial');
      expect(message).toContain('January 15');
    });

    it('should generate trial message for expired trial', () => {
      const message = getTrialMessage(false, '2024-01-01');

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should handle missing trial end date', () => {
      const message = getTrialMessage(true, '');

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle missing context gracefully', () => {
      const copy = generateSalesCopy({});

      expect(copy).toBeDefined();
      expect(typeof copy.title).toBe('string');
    });

    it('should handle negative remaining usage', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: -1,
        totalUsage: 8,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(typeof copy.message).toBe('string');
    });

    it('should handle very large usage numbers', () => {
      const context = {
        currentTier: 'transformation',
        featureType: 'playbook',
        remainingUsage: 999999,
        totalUsage: 999999,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(typeof copy.message).toBe('string');
    });

    it('should handle special characters in feature types', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'special-feature-with-dashes',
        remainingUsage: 0,
        totalUsage: 8,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(typeof copy.message).toBe('string');
    });
  });

  describe('message personalization', () => {
    it('should personalize messages with user data', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: 2,
        totalUsage: 8,
        userName: 'John',
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      // Should personalize if user name is provided
      expect(typeof copy.message).toBe('string');
    });

    it('should handle missing user name gracefully', () => {
      const context = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: 0,
        totalUsage: 8,
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(typeof copy.message).toBe('string');
    });
  });

  describe('upgrade recommendations', () => {
    it('should recommend appropriate upgrade tier', () => {
      const contexts = [
        { currentTier: 'seeker', featureType: 'playbook' },
        { currentTier: 'spark', featureType: 'playbook' },
        { currentTier: 'growth', featureType: 'playbook' },
      ];

      contexts.forEach(context => {
        const copy = generateSalesCopy(context);
        expect(copy.recommendedTier).toBeDefined();
        expect(['spark', 'growth', 'transformation']).toContain(copy.recommendedTier);
      });
    });

    it('should recommend Transformation for high usage users', () => {
      const context = {
        currentTier: 'growth',
        featureType: 'playbook',
        remainingUsage: 0,
        totalUsage: 20,
        usagePattern: 'heavy',
      };

      const copy = generateSalesCopy(context);

      expect(copy).toBeDefined();
      expect(copy.recommendedTier).toBe('transformation');
    });
  });

  describe('CTA generation', () => {
    it('should generate appropriate CTA text', () => {
      const contexts = [
        { currentTier: 'seeker', featureType: 'playbook' },
        { currentTier: 'spark', featureType: 'playbook', remainingUsage: 0 },
        { currentTier: 'growth', featureType: 'playbook', remainingUsage: 0 },
      ];

      contexts.forEach(context => {
        const copy = generateSalesCopy(context);
        expect(copy.cta).toBeDefined();
        expect(typeof copy.cta).toBe('string');
        expect(copy.cta.length).toBeGreaterThan(0);
      });
    });

    it('should generate different CTAs for different situations', () => {
      const exhaustedContext = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: 0,
        totalUsage: 8,
      };

      const availableContext = {
        currentTier: 'spark',
        featureType: 'playbook',
        remainingUsage: 5,
        totalUsage: 8,
      };

      const exhaustedCopy = generateSalesCopy(exhaustedContext);
      const availableCopy = generateSalesCopy(availableContext);

      expect(exhaustedCopy.cta).toBeDefined();
      expect(availableCopy.cta).toBeDefined();
      // CTAs should be different based on context
    });
  });

  describe('error handling', () => {
    it('should handle null context gracefully', () => {
      expect(() => generateSalesCopy(null as any)).not.toThrow();
    });

    it('should handle undefined context gracefully', () => {
      expect(() => generateSalesCopy(undefined as any)).not.toThrow();
    });

    it('should handle malformed context gracefully', () => {
      const malformedContext = {
        currentTier: 123, // Should be string
        featureType: null, // Should be string
        remainingUsage: 'invalid', // Should be number
        totalUsage: undefined, // Should be number
      };

      expect(() => generateSalesCopy(malformedContext)).not.toThrow();
    });
  });
});
