export type PlaybookInputValidationResult = {
  isValid: boolean;
  message?: string;
};

const MISTYPE_MESSAGES = [
  'I didn’t quite understand that. Take a moment and try putting it another way.',
  'That didn’t come through clearly. Try sharing it a little differently.',
  'I’m not sure what you meant there. Try saying it another way.',
  'That was hard to understand. When you’re ready, try putting it into different words.',
];

const normalizeInput = (input: string) => input.trim().replace(/\s+/g, ' ');

const getWords = (input: string): string[] => {
  const matches = normalizeInput(input).toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g);
  return matches ? Array.from(matches) : [];
};

const hasExcessiveRepeatedCharacters = (input: string) => /(.)\1{4,}/i.test(input);

const hasKeyboardMashingPattern = (input: string) => {
  const compact = input.toLowerCase().replace(/[^a-z]/g, '');
  if (compact.length < 10) {
    return false;
  }

  return /[bcdfghjklmnpqrstvwxyz]{7,}/.test(compact) || /[aeiou]{6,}/.test(compact);
};

const isNumericOnly = (input: string) => /^[\d\s.,!?'"-]+$/.test(input);

const hasMixedRandomAlphaNumericToken = (input: string) => {
  const tokens = normalizeInput(input).split(/\s+/);
  return tokens.some(token => /[a-z]/i.test(token) && /\d/.test(token) && token.length >= 5);
};

const isSingleLikelyGibberishWord = (words: string[]) => {
  if (words.length !== 1) {
    return false;
  }

  const word = words[0];
  if (word.length < 8) {
    return false;
  }

  return !/[aeiouy]/.test(word) || /[bcdfghjklmnpqrstvwxyz]{6,}/.test(word);
};

const hasGibberishWordInPhrase = (words: string[]) => {
  return words.some(word => {
    if (word.length < 5) {
      return false;
    }

    const hasNoVowels = !/[aeiouy]/.test(word);
    const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxyz]{4,}/.test(word);
    const hasExcessiveRepeats = /(.)\1{2,}/.test(word);
    const vowelCount = (word.match(/[aeiouy]/gi) || []).length;
    const hasTooFewVowels = word.length >= 6 && vowelCount <= 2;
    const hasVeryFewVowels = word.length >= 8 && vowelCount <= 1;

    return hasNoVowels || hasLongConsonantRun || hasExcessiveRepeats || hasTooFewVowels || hasVeryFewVowels;
  });
};

const hasTooManyEmojis = (input: string) => {
  const emojiPattern = /[\p{Emoji}]/gu;
  const emojis = (input.match(emojiPattern) || []).length;
  const textChars = input.replace(emojiPattern, '').replace(/\s/g, '').length;

  if (emojis === 0) {
    return false;
  }

  if (textChars === 0) {
    return true;
  }

  return emojis > textChars;
};

export const validatePlaybookInputQuality = (input: string): PlaybookInputValidationResult => {
  const normalized = normalizeInput(input);

  if (!normalized) {
    return {
      isValid: false,
      message: 'Share a little about what happened or what you need help with.',
    };
  }

  const words = getWords(normalized);

  if (
    isNumericOnly(normalized) ||
    hasMixedRandomAlphaNumericToken(normalized) ||
    isSingleLikelyGibberishWord(words) ||
    hasGibberishWordInPhrase(words) ||
    hasTooManyEmojis(normalized) ||
    hasExcessiveRepeatedCharacters(normalized) ||
    hasKeyboardMashingPattern(normalized)
  ) {
    return {
      isValid: false,
      message: MISTYPE_MESSAGES[Math.floor(Math.random() * MISTYPE_MESSAGES.length)],
    };
  }

  return { isValid: true };
};
