/**
 * rateLimiting.test.ts
 * Test suite for rate limiting utility
 */

import { RateLimiter } from '../rateLimiting';

// Mock timers
jest.useFakeTimers();

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic rate limiting', () => {
    it('should allow requests within limit', async () => {
      const limiter = new RateLimiter(5, 1000); // 5 requests per second

      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit('user-123');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', async () => {
      const limiter = new RateLimiter(2, 1000); // 2 requests per second

      // First 2 requests should pass
      await limiter.checkLimit('user-123');
      await limiter.checkLimit('user-123');

      // Third request should be blocked
      const result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const limiter = new RateLimiter(2, 1000); // 2 requests per second

      // Use up the limit
      await limiter.checkLimit('user-123');
      await limiter.checkLimit('user-123');

      // Should be blocked
      let result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(false);

      // Advance time by 1 second
      jest.advanceTimersByTime(1000);

      // Should be allowed again
      result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe('multiple users', () => {
    it('should track limits separately for different users', async () => {
      const limiter = new RateLimiter(2, 1000);

      // User 1 uses their limit
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-1');

      // User 1 should be blocked
      let result1 = await limiter.checkLimit('user-1');
      expect(result1.allowed).toBe(false);

      // User 2 should still be allowed
      let result2 = await limiter.checkLimit('user-2');
      expect(result2.allowed).toBe(true);
    });

    it('should handle many concurrent users', async () => {
      const limiter = new RateLimiter(10, 1000);
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      // Each user makes one request
      const results = await Promise.all(
        users.map(user => limiter.checkLimit(user))
      );

      // All should be allowed
      results.forEach(result => {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
      });
    });
  });

  describe('different rate limits', () => {
    it('should handle different limits for different operations', async () => {
      const loginLimiter = new RateLimiter(5, 60000); // 5 per minute

      // Use up login limit
      for (let i = 0; i < 5; i++) {
        await loginLimiter.checkLimit('user-123');
      }

      // Login should be blocked
      let loginResult = await loginLimiter.checkLimit('user-123');
      expect(loginResult.allowed).toBe(false);

      // API should still be allowed
      for (let i = 0; i < 10; i++) {
        let apiResult = await apiLimiter.checkLimit('user-123');
        expect(apiResult.allowed).toBe(true);
      }
    });
  });

  describe('sliding window', () => {
    it('should implement sliding window correctly', async () => {
      const limiter = new RateLimiter(3, 3000); // 3 per 3 seconds

      // Make requests at different times
      await limiter.checkLimit('user-123'); // t=0
      jest.advanceTimersByTime(1000);
      await limiter.checkLimit('user-123'); // t=1
      jest.advanceTimersByTime(1000);
      await limiter.checkLimit('user-123'); // t=2

      // Should be blocked
      let result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(false);

      // Advance time by 1 second (t=3)
      jest.advanceTimersByTime(1000);

      // First request should have fallen out of window
      result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
    });
  });

  describe('burst handling', () => {
    it('should handle burst requests correctly', async () => {
      const limiter = new RateLimiter(10, 1000);

      // Make burst of requests
      const results = await Promise.all(
        Array.from({ length: 15 }, () => limiter.checkLimit('user-123'))
      );

      // First 10 should be allowed
      results.slice(0, 10).forEach(result => {
        expect(result.allowed).toBe(true);
      });

      // Last 5 should be blocked
      results.slice(10).forEach(result => {
        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('statistics', () => {
    it('should provide statistics for user', async () => {
      const limiter = new RateLimiter(5, 1000);

      // Make some requests
      await limiter.checkLimit('user-123');
      await limiter.checkLimit('user-123');

      const stats = limiter.getStats('user-123');
      expect(stats.requests).toBe(2);
      expect(stats.remaining).toBe(3);
      expect(stats.resetTime).toBeDefined();
    });

    it('should provide global statistics', async () => {
      const limiter = new RateLimiter(5, 1000);

      // Make requests from different users
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-2');
      await limiter.checkLimit('user-1');

      const globalStats = limiter.getGlobalStats();
      expect(globalStats.totalUsers).toBe(2);
      expect(globalStats.totalRequests).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired entries', async () => {
      const limiter = new RateLimiter(5, 1000);

      // Make requests
      await limiter.checkLimit('user-123');
      await limiter.checkLimit('user-456');

      // Advance time beyond window
      jest.advanceTimersByTime(2000);

      // Cleanup should remove expired entries
      limiter.cleanup();

      // Stats should be reset
      const stats1 = limiter.getStats('user-123');
      const stats2 = limiter.getStats('user-456');

      expect(stats1.requests).toBe(0);
      expect(stats2.requests).toBe(0);
    });

    it('should handle cleanup errors gracefully', () => {
      const limiter = new RateLimiter(5, 1000);

      expect(() => limiter.cleanup()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid user IDs', async () => {
      const limiter = new RateLimiter(5, 1000);

      const result = await limiter.checkLimit('');
      expect(result.allowed).toBe(true);
    });

    it('should handle null user IDs', async () => {
      const limiter = new RateLimiter(5, 1000);

      const result = await limiter.checkLimit(null as any);
      expect(result.allowed).toBe(true);
    });

    it('should handle invalid rate limits', () => {
      expect(() => new RateLimiter(0, 1000)).not.toThrow();
      expect(() => new RateLimiter(-1, 1000)).not.toThrow();
      expect(() => new RateLimiter(5, 0)).not.toThrow();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent requests safely', async () => {
      const limiter = new RateLimiter(10, 1000);

      // Make many concurrent requests
      const promises = Array.from({ length: 50 }, () =>
        limiter.checkLimit('user-123')
      );

      const results = await Promise.all(promises);

      // Should have exactly 10 allowed requests
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(10);

      // Should have 40 blocked requests
      const blockedCount = results.filter(r => !r.allowed).length;
      expect(blockedCount).toBe(40);
    });
  });

  describe('memory management', () => {
    it('should not leak memory over time', async () => {
      const limiter = new RateLimiter(5, 1000);

      // Simulate many users over time
      for (let i = 0; i < 1000; i++) {
        await limiter.checkLimit(`user-${i}`);

        // Advance time to trigger cleanup
        if (i % 100 === 0) {
          jest.advanceTimersByTime(2000);
          limiter.cleanup();
        }
      }

      // Memory usage should be reasonable
      const globalStats = limiter.getGlobalStats();
      expect(globalStats.totalUsers).toBeLessThan(100);
    });
  });

  describe('edge cases', () => {
    it('should handle very short windows', async () => {
      const limiter = new RateLimiter(1, 1); // 1 request per millisecond

      await limiter.checkLimit('user-123');
      let result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(false);

      jest.advanceTimersByTime(1);
      result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
    });

    it('should handle very long windows', async () => {
      const limiter = new RateLimiter(100, 3600000); // 100 per hour

      // Should work normally
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit('user-123');
        expect(result.allowed).toBe(true);
      }
    });

    it('should handle zero limits', async () => {
      const limiter = new RateLimiter(0, 1000);

      const result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(false);
    });
  });
});
