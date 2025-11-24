/**
 * textFormatting.test.ts
 * Test suite for text formatting utilities
 */

import { cleanText, formatBibleVerse } from '../textFormatting';

describe('text formatting utilities', () => {
  describe('cleanText', () => {
    it('should clean escaped quotes', () => {
      const text = 'This is \\"a test\\" with quotes';
      const result = cleanText(text);

      expect(result).toBe('This is "a test" with quotes');
    });

    it('should remove backslashes', () => {
      const text = 'Text with\\ backslash';
      const result = cleanText(text);

      expect(result).toBe('Text with backslash');
    });

    it('should replace smart quotes with straight quotes', () => {
      const text = 'Smart quotes: "Hello" and \'world\'';
      const result = cleanText(text);

      expect(result).toBe('Smart quotes: "Hello" and \'world\'');
    });

    it('should clean up multiple spaces', () => {
      const text = 'Text    with     multiple   spaces';
      const result = cleanText(text);

      expect(result).toBe('Text with multiple spaces');
    });

    it('should trim whitespace', () => {
      const text = '  Text with spaces around  ';
      const result = cleanText(text);

      expect(result).toBe('Text with spaces around');
    });

    it('should handle empty string', () => {
      const result = cleanText('');

      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(cleanText(null as any)).toBe('');
      expect(cleanText(undefined as any)).toBe('');
    });

    it('should handle complex text with all issues', () => {
      const text = '  \\"Hello\\"  \\"world\\"  with  smart  quotes: "test"  ';
      const result = cleanText(text);

      expect(result).toBe('"Hello" "world" with smart quotes: "test"');
    });
  });

  describe('formatBibleVerse', () => {
    it('should format bible verse correctly', () => {
      const verse = 'For God so loved the world';
      const result = formatBibleVerse(verse);

      expect(result).toBe('For God so loved the world');
    });

    it('should handle verse with quotes', () => {
      const verse = '"Love your neighbor as yourself"';
      const result = formatBibleVerse(verse);

      expect(result).toBe('Love your neighbor as yourself');
    });

    it('should fix spacing around punctuation', () => {
      const verse = 'Trust in the Lord with all your heart , and lean not on your own understanding .';
      const result = formatBibleVerse(verse);

      expect(result).toBe('Trust in the Lord with all your heart, and lean not on your own understanding.');
    });

    it('should handle smart quotes in verses', () => {
      const verse = '"I am the way and the truth and the life"';
      const result = formatBibleVerse(verse);

      expect(result).toBe('I am the way and the truth and the life');
    });

    it('should handle empty verse', () => {
      expect(formatBibleVerse('')).toBe('');
      expect(formatBibleVerse(null as any)).toBe('');
      expect(formatBibleVerse(undefined as any)).toBe('');
    });

    it('should handle verse with mixed punctuation', () => {
      const verse = '  "Be still ,and know that I am God" ;  ';
      const result = formatBibleVerse(verse);

      // Check that it cleans up appropriately
      expect(result).toContain('Be still');
      expect(result).toContain('know that I am God');
    });

    it('should preserve apostrophes in contractions', () => {
      const verse = "Don't worry about anything";
      const result = formatBibleVerse(verse);

      expect(result).toBe("Don't worry about anything");
    });

    it('should handle complex verse with multiple issues', () => {
      const verse = '  "God  is  love"  ;  "Love  one  another"  .  ';
      const result = formatBibleVerse(verse);

      // Check that it cleans up appropriately
      expect(result).toContain('God is love');
      expect(result).toContain('Love one another');
    });
  });
});
