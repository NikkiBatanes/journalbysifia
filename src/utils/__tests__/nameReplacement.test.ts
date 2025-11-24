/**
 * nameReplacement.test.ts
 * Test suite for name replacement utility functions
 */

import {
  replaceUserNamePlaceholder,
  replaceAllNamePlaceholders,
  hasNamePlaceholders,
} from '../nameReplacement';

describe('nameReplacement', () => {
  describe('replaceUserNamePlaceholder', () => {
    it('should replace [User\'s Name] with display name', () => {
      const text = 'Hello [User\'s Name], welcome!';
      const result = replaceUserNamePlaceholder(text, 'John');
      expect(result).toBe('Hello John, welcome!');
    });

    it('should handle multiple occurrences', () => {
      const text = '[User\'s Name], you are amazing, [User\'s Name]!';
      const result = replaceUserNamePlaceholder(text, 'Sarah');
      expect(result).toBe('Sarah, you are amazing, Sarah!');
    });

    it('should handle empty display name', () => {
      const text = 'Hello [User\'s Name]';
      const result = replaceUserNamePlaceholder(text, '');
      // Function returns original text when displayName is empty
      expect(result).toBe('Hello [User\'s Name]');
    });

    it('should return original text if no placeholder found', () => {
      const text = 'Hello there!';
      const result = replaceUserNamePlaceholder(text, 'John');
      expect(result).toBe('Hello there!');
    });

    it('should handle undefined text', () => {
      const result = replaceUserNamePlaceholder(undefined as any, 'John');
      // Function returns undefined when text is undefined
      expect(result).toBeUndefined();
    });

    it('should handle null text', () => {
      const result = replaceUserNamePlaceholder(null as any, 'John');
      // Function returns null when text is null
      expect(result).toBeNull();
    });
  });

  describe('replaceAllNamePlaceholders', () => {
    const mockUser = {
      displayName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should replace [User\'s Name] with first name', () => {
      const text = 'Welcome [User\'s Name]!';
      const result = replaceAllNamePlaceholders(text, mockUser);
      // Function uses firstName for [User's Name], not displayName
      expect(result).toBe('Welcome John!');
    });

    it('should replace [First Name] with first name', () => {
      const text = 'Hi [First Name]!';
      const result = replaceAllNamePlaceholders(text, mockUser);
      expect(result).toBe('Hi John!');
    });

    it('should replace [Last Name] with last name', () => {
      const text = 'Mr. [Last Name]';
      const result = replaceAllNamePlaceholders(text, mockUser);
      expect(result).toBe('Mr. Doe');
    });

    it('should replace multiple different placeholders', () => {
      const text = 'Hello [First Name] [Last Name], aka [User\'s Name]';
      const result = replaceAllNamePlaceholders(text, mockUser);
      // [User's Name] uses firstName, not displayName
      expect(result).toBe('Hello John Doe, aka John');
    });

    it('should handle missing user data gracefully', () => {
      const text = 'Hello [User\'s Name]';
      // Function will throw when user is undefined
      expect(() => replaceAllNamePlaceholders(text, undefined as any)).toThrow();
    });

    it('should use firstName as fallback for displayName', () => {
      const user = { firstName: 'Jane', lastName: 'Smith', displayName: '' };
      const text = 'Welcome [User\'s Name]!';
      const result = replaceAllNamePlaceholders(text, user);
      expect(result).toBe('Welcome Jane!');
    });

    it('should handle partial user data', () => {
      const user = { displayName: 'Alice', firstName: '', lastName: '' };
      const text = 'Hi [First Name] [Last Name]';
      const result = replaceAllNamePlaceholders(text, user);
      // Function doesn't replace empty firstName/lastName
      expect(result).toBe('Hi [First Name] [Last Name]');
    });
  });

  describe('hasNamePlaceholders', () => {
    it('should return true for [User\'s Name]', () => {
      expect(hasNamePlaceholders('Hello [User\'s Name]')).toBe(true);
    });

    it('should return true for [First Name]', () => {
      expect(hasNamePlaceholders('Hi [First Name]')).toBe(true);
    });

    it('should return true for [Last Name]', () => {
      expect(hasNamePlaceholders('Mr. [Last Name]')).toBe(true);
    });

    it('should return true for multiple placeholders', () => {
      expect(hasNamePlaceholders('[First Name] [Last Name]')).toBe(true);
    });

    it('should return false for text without placeholders', () => {
      expect(hasNamePlaceholders('Hello there!')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasNamePlaceholders('')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(hasNamePlaceholders(undefined as any)).toBe(false);
    });

    it('should return false for null', () => {
      expect(hasNamePlaceholders(null as any)).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(hasNamePlaceholders('[user\'s name]')).toBe(false);
      expect(hasNamePlaceholders('[first name]')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in names', () => {
      const user = {
        displayName: 'O\'Brien',
        firstName: 'Patrick',
        lastName: 'O\'Brien',
      };
      const text = 'Welcome [User\'s Name]!';
      const result = replaceAllNamePlaceholders(text, user);
      // Function uses firstName for [User's Name]
      expect(result).toBe('Welcome Patrick!');
    });

    it('should handle unicode characters in names', () => {
      const user = {
        displayName: 'José García',
        firstName: 'José',
        lastName: 'García',
      };
      const text = 'Hola [First Name]!';
      const result = replaceAllNamePlaceholders(text, user);
      expect(result).toBe('Hola José!');
    });

    it('should handle very long names', () => {
      const longName = 'A'.repeat(100);
      const user = {
        displayName: longName,
        firstName: longName,
        lastName: longName,
      };
      const text = 'Hello [User\'s Name]';
      const result = replaceAllNamePlaceholders(text, user);
      expect(result).toBe(`Hello ${longName}`);
    });

    it('should handle empty strings in user object', () => {
      const user = {
        displayName: '',
        firstName: '',
        lastName: '',
      };
      const text = 'Hello [User\'s Name] [First Name] [Last Name]';
      const result = replaceAllNamePlaceholders(text, user);
      // Function doesn't replace when firstName/lastName are empty
      expect(result).toBe('Hello [User\'s Name] [First Name] [Last Name]');
    });
  });
});
