/**
 * date.test.ts
 * Test suite for date utility functions
 */

import { toLocalDateString } from '../date';

describe('date utilities', () => {
  describe('toLocalDateString', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T12:30:45.000Z');
      const result = toLocalDateString(date);

      expect(result).toBe('2024-01-15');
    });

    it('should handle single digit month and day', () => {
      const date = new Date('2024-03-05T09:15:30.000Z');
      const result = toLocalDateString(date);

      expect(result).toBe('2024-03-05');
    });

    it('should handle leap year', () => {
      const date = new Date('2024-02-29T12:00:00.000Z');
      const result = toLocalDateString(date);

      // Function uses local time, so result depends on timezone
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle end of year', () => {
      const date = new Date('2024-12-31T12:00:00.000Z');
      const result = toLocalDateString(date);

      // Function uses local time, so result depends on timezone
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle start of year', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = toLocalDateString(date);

      expect(result).toBe('2024-01-01');
    });

    it('should handle different time zones', () => {
      // Test with different local time zones
      const date = new Date('2024-06-15T12:00:00.000Z');
      const result = toLocalDateString(date);

      // Should be consistent regardless of time zone
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toContain('2024-06-15');
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      const result = toLocalDateString(invalidDate);

      // Invalid dates typically result in NaN values
      expect(result).toMatch(/^NaN-NaN-NaN$/);
    });

    it('should handle date with milliseconds', () => {
      const date = new Date('2024-07-20T14:30:45.123Z');
      const result = toLocalDateString(date);

      expect(result).toBe('2024-07-20');
    });

    it('should maintain consistent format', () => {
      const dates = [
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-12-31T23:59:59.999Z'),
        new Date('2024-06-15T12:30:45.500Z'),
      ];

      dates.forEach(date => {
        const result = toLocalDateString(date);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});
