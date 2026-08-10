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

  return keyboardSequences.some(sequence => compact.includes(sequence));
};

const isNumericOnly = (input: string) => /^[\d\s.,!?'"-]+$/.test(input);

const normalizeAlphaNumericToken = (token: string) =>
  token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

const isCommonAlphaNumericShorthand = (token: string) => {
  const normalized = normalizeAlphaNumericToken(token);

  if (!normalized) {
    return false;
  }

  const numberUnitPattern = /^\d+(?:[.,]\d+)?[-_/]?(?:k|m|b|mm|sqm|sqft|sqyd|m2|ft2|yd2|ha|hectares?|acres?|lots?|units?|yrs?|years?|mos?|months?|days?|hrs?|hours?|mins?|minutes?|x|percent|pct)$/i;
  const currencyPattern = /^(?:p|php|usd|aud|cad|eur|gbp|sgd|jpy|peso|pesos|dollars?)\d+(?:[.,]\d+)?(?:k|m|b|mm)?$/i;

  return numberUnitPattern.test(normalized) || currencyPattern.test(normalized);
};

const hasMixedRandomAlphaNumericToken = (input: string) => {
  const tokens = normalizeInput(input).split(/\s+/);
  return tokens.some(token =>
    /[a-z]/i.test(token) &&
    /\d/.test(token) &&
    normalizeAlphaNumericToken(token).length >= 5 &&
    !isCommonAlphaNumericShorthand(token)
  );
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
