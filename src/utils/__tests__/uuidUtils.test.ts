/**
 * Tests for UUID utility functions
 */

import { generateUUID, isValidUUID, ensureValidUUID, generateShortUUID } from '../uuidUtils';

describe('UUID Utils', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID v4', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      ];

      validUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    it('should return false for invalid UUIDs', () => {
      const invalidUUIDs = [
        '1753647531105', // numeric timestamp
        'invalid-uuid',
        '550e8400-e29b-41d4-a716', // too short
        '550e8400-e29b-41d4-a716-446655440000-extra', // too long
        '', // empty string
        null,
        undefined
      ];

      invalidUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid as string)).toBe(false);
      });
    });
  });

  describe('ensureValidUUID', () => {
    it('should return the same UUID if valid', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const result = ensureValidUUID(validUUID, 'test');
      expect(result).toBe(validUUID);
    });

    it('should generate a new UUID if invalid', () => {
      const invalidUUID = '1753647531105';
      const result = ensureValidUUID(invalidUUID, 'test');
      expect(result).not.toBe(invalidUUID);
      expect(isValidUUID(result)).toBe(true);
    });

    it('should generate a new UUID if null or undefined', () => {
      const result1 = ensureValidUUID(null, 'test');
      const result2 = ensureValidUUID(undefined, 'test');
      
      expect(isValidUUID(result1)).toBe(true);
      expect(isValidUUID(result2)).toBe(true);
    });
  });

  describe('generateShortUUID', () => {
    it('should generate an 8-character string', () => {
      const shortUUID = generateShortUUID();
      expect(shortUUID).toHaveLength(8);
      expect(shortUUID).toMatch(/^[0-9a-f]{8}$/i);
    });
  });
});
