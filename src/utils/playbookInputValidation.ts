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

const MIN_CONTEXT_MESSAGE = 'Share a little more about what happened or what you need help with.';

const normalizeInput = (input: string) => input.trim().replace(/\s+/g, ' ');

const getWords = (input: string): string[] => {
  const matches = normalizeInput(input).toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g);
  return matches ? Array.from(matches) : [];
};

const hasExcessiveRepeatedCharacters = (input: string) => /(.)\1{3,}/i.test(input);

const hasKeyboardMashingPattern = (input: string) => {
  const compact = input.toLowerCase().replace(/[^a-z]/g, '');
  if (compact.length < 4) {
    return false;
  }

  const keyboardSequences = [
    'qwerty',
    'asdf',
    'zxcv',
    'hjkl',
    'dfgh',
    'jkl',
    'sdf',
    'fgh',
    'cvbn',
    'vbnm',
  ];

  return keyboardSequences.some(sequence => compact.includes(sequence)) ||
    /[bcdfghjklmnpqrstvwxyz]{4,}/.test(compact) ||
    /[aeiou]{4,}/.test(compact);
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
  if (word.length < 4) {
    return false;
  }

  return !/[aeiouy]/.test(word) ||
    /[bcdfghjklmnpqrstvwxyz]{4,}/.test(word) ||
    /([aeiou][bcdfghjklmnpqrstvwxyz]){3,}/.test(word) ||
    /([bcdfghjklmnpqrstvwxyz][aeiou]){3,}/.test(word) ||
    /^(asdf|qwer|qwerty|zxcv|hjkl|dfgh|jkl|sdf|fgh|cvbn|vbnm)/.test(word);
};

const hasEnoughContext = (words: string[]) => {
  if (words.length >= 2) {
    return true;
  }

  const [word] = words;
  return Boolean(word && word.length >= 15);
};

const hasGibberishWordInPhrase = (words: string[]) => {
  return words.some(word => {
    if (word.length < 5) {
      return false;
    }

    const hasNoVowels = !/[aeiouy]/.test(word);
    const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxz]{5,}/.test(word);
    const hasExcessiveRepeats = /(.)\1{2,}/.test(word);
    const vowelCount = (word.match(/[aeiouy]/gi) || []).length;
    const vowelRatio = vowelCount / word.length;
    const hasVeryFewVowels = word.length >= 8 && vowelCount <= 1;
    const hasSuspiciouslyLowVowelRatio = word.length >= 10 && vowelRatio < 0.2;

    return hasNoVowels || hasLongConsonantRun || hasExcessiveRepeats || hasVeryFewVowels || hasSuspiciouslyLowVowelRatio;
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

  if (!hasEnoughContext(words)) {
    return {
      isValid: false,
      message: MIN_CONTEXT_MESSAGE,
    };
  }

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
