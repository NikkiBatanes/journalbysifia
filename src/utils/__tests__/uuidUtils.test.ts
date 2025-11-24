/**
 * uuidUtils.test.ts
 * Test suite for UUID utility functions
 */

import { generateUUID, isValidUUID } from '../uuidUtils';

describe('uuidUtils', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toBeTruthy();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      const uuid3 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });

    it('should generate UUIDs in correct format', () => {
      const uuid = generateUUID();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(uuid)).toBe(true);
    });

    it('should generate 100 unique UUIDs', () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID v4', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('should return true for generated UUIDs', () => {
      const uuid = generateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should return false for invalid UUID format', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidUUID(undefined as any)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidUUID(null as any)).toBe(false);
    });

    it('should return false for UUID with wrong version', () => {
      // UUID v6 format (not supported - only v1-v5 are valid)
      const uuidV6 = '550e8400-e29b-66d4-a716-446655440000';
      expect(isValidUUID(uuidV6)).toBe(false);
    });

    it('should return false for UUID with wrong variant', () => {
      // Wrong variant (should be 8, 9, a, or b)
      const wrongVariant = '550e8400-e29b-41d4-0716-446655440000';
      expect(isValidUUID(wrongVariant)).toBe(false);
    });

    it('should handle uppercase UUIDs', () => {
      const upperUUID = '550E8400-E29B-41D4-A716-446655440000';
      expect(isValidUUID(upperUUID)).toBe(true);
    });

    it('should handle mixed case UUIDs', () => {
      const mixedUUID = '550e8400-E29B-41d4-A716-446655440000';
      expect(isValidUUID(mixedUUID)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should validate all generated UUIDs', () => {
      for (let i = 0; i < 50; i++) {
        const uuid = generateUUID();
        expect(isValidUUID(uuid)).toBe(true);
      }
    });

    it('should handle rapid UUID generation', () => {
      const uuids: string[] = [];
      for (let i = 0; i < 1000; i++) {
        uuids.push(generateUUID());
      }

      // All should be unique
      const uniqueUUIDs = new Set(uuids);
      expect(uniqueUUIDs.size).toBe(1000);

      // All should be valid
      uuids.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });
  });
});
