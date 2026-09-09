export type CanonicalQuotedInstruction = {
  prefix?: string;
  label: string;
  quote: string;
  rest?: string;
};

function isActionApostrophe(text: string, index: number): boolean {
  const char = text[index];
  if (char !== "'" && char !== '‘' && char !== '’') {
    return false;
  }
  return /[A-Za-z0-9]/.test(text[index - 1] || '') && /[A-Za-z0-9]/.test(text[index + 1] || '');
}

function stripBalancedQuotes(text: string): string {
  let out = String(text || '').trim();
  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’'],
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of quotePairs) {
      if (out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(1, -1).trim();
        changed = true;
        break;
      }
    }
  }

  return out.replace(/,\s*([.!?])/g, '$1');
}

function splitLeadingQuote(value: string): { quote: string; rest: string } | null {
  const source = String(value || '').trim();
  const open = source[0];
  if (open !== '"' && open !== '“' && open !== "'" && open !== '‘') {
    return null;
  }

  const close = open === '“' ? '”' : open === '‘' ? '’' : open;
  for (let i = 1; i < source.length; i++) {
    if (source[i] === close && source[i - 1] !== '\\' && !isActionApostrophe(source, i)) {
      const rawQuote = source.slice(0, i + 1).trim();
      const quote = open === "'" || open === '‘'
        ? `"${stripBalancedQuotes(rawQuote)}"`
        : rawQuote;
      return {
        quote,
        rest: source.slice(i + 1).trim(),
      };
    }
  }

  return { quote: source, rest: '' };
}

function isQuotedInstructionIntro(value: string): boolean {
  const intro = String(value || '')
    .trim()
    .replace(/:\s*$/, '');

  if (!intro || intro.length > 180) {
    return false;
  }

  if (/^(?:if|when|after)\b.{0,120}\b(?:say|reply|respond|text|message|ask|pray|prayer)\b/i.test(intro)) {
    return true;
  }

  if (/^(?:then|next)\b.{0,80}\b(?:say|write|pray|ask|reply|text|message)\b/i.test(intro)) {
    return true;
  }

  if (/^(?:finish|end)\b.{0,80}\b(?:say|saying|pray|praying|with)\b/i.test(intro)) {
    return true;
  }

  if (/^(?:message|text|send)\b/i.test(intro)) {
    return true;
  }

  if (/\b(?:call|contact|phone|clinic|doctor|office)\b.{0,140}\bsay\b/i.test(intro)) {
    return true;
  }

  return /\b(?:say|tell|write|send|text|message|ask|reply|respond|pray|explain|add|continue|follow|practice)\b/i.test(intro) &&
    /\b(?:this|him|her|them|husband|wife|spouse|person|message|text|script|plainly|aloud|quietly|briefly|silently|yourself|example|words?|reply|sentence|question|prayer|pray|ask|request|reason|with|down|like)\b/i.test(intro);
}

function instructionLabelForIntro(intro: string): string {
  return String(intro || '')
    .trim()
    .replace(/:\s*$/, '')
    .replace(/\s+/g, ' ');
}

function sentenceWithPeriod(value: string): string | undefined {
  const text = String(value || '')
    .trim()
    .replace(/\s+(?:and|then)\s*$/i, '')
    .replace(/[,;:\s]+$/g, '')
    .trim();

  if (!text) {
    return undefined;
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function quoteLooksLikePrayer(quote: string): boolean {
  const text = stripBalancedQuotes(quote)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();

  return /^(?:lord|jesus|god|father|heavenly father|holy spirit)\b/i.test(text);
}

function prayerCueContext(intro: string): string | undefined {
  const normalized = instructionLabelForIntro(intro);
  const context = normalized.replace(
    /\s*(?:and\s+|then\s+)?(?:say|pray)(?:\s+(?:a\s+short\s+prayer|the\s+prayer|this\s+prayer|these\s+words|this|it|quietly|briefly|aloud|out\s+loud|slowly|clearly|or\s+write(?:\s+down)?|like))*$/i,
    '',
  );

  return context === normalized ? undefined : sentenceWithPeriod(context);
}

function quotedInstructionParts(intro: string, quote: string): Pick<CanonicalQuotedInstruction, 'label' | 'prefix'> {
  if (quoteLooksLikePrayer(quote)) {
    return {
      label: 'Prayer to say',
      prefix: prayerCueContext(intro),
    };
  }

  const normalized = instructionLabelForIntro(intro);
  if (/^(?:for example,\s*)?(?:you\s+(?:might|can)\s+)?write\b/i.test(normalized)) {
    return {
      label: 'Example to write',
    };
  }

  if (/^say\s+this\s+prayer\b/i.test(normalized)) {
    return {
      label: 'Prayer to say',
    };
  }

  if (/^ask(?:\s+(?:him|her|them|your\s+(?:husband|wife|spouse|friend|pastor|leader)))?\b/i.test(normalized)) {
    return {
      label: 'Ask',
    };
  }

  if (/^follow\s+with(?:\s+this\s+question)?\b/i.test(normalized)) {
    return {
      label: 'Ask',
    };
  }

  if (/^(?:message|text|send)\b/i.test(normalized)) {
    return {
      label: 'Message to send',
    };
  }

  if (/^(?:if|when|after)\b/i.test(normalized) && /\b(?:say|reply|respond|text|message)\b/i.test(normalized)) {
    if (/^if\s+they\s+ask\b/i.test(normalized)) {
      return { label: 'If they ask' };
    }
    if (/^if\s+they\s+respond\b/i.test(normalized)) {
      return { label: 'If they respond' };
    }
    return { label: 'Possible reply' };
  }

  const sayToYourself = normalized.match(/^(.*?)(?:[,;]\s*)?(?:for example,\s*)?say\s+to\s+yourself$/i);
  if (sayToYourself) {
    return {
      label: 'Say to yourself',
      prefix: sentenceWithPeriod(sayToYourself[1]),
    };
  }

  const callScript = normalized.match(/^(.+?)\s+(?:and\s+)?say(?:\s+(?:calmly|quietly|plainly|clearly))?$/i);
  if (callScript && /\b(?:call|contact|phone|clinic|doctor|office)\b/i.test(callScript[1])) {
    return {
      label: 'Call script',
      prefix: sentenceWithPeriod(callScript[1]),
    };
  }

  const spokenScript = normalized.match(/^(.+?)\s+(?:and\s+)?say(?:\s+(?:aloud|out\s+loud|calmly|quietly|plainly|clearly|slowly))?$/i);
  if (spokenScript) {
    return {
      label: 'Words to say',
      prefix: sentenceWithPeriod(spokenScript[1]),
    };
  }

  return {
    label: normalized,
  };
}

function parseInlineInstruction(value: string): CanonicalQuotedInstruction | null {
  const match = String(value || '').trim().match(/^(.{1,180}?:\s*)(["'“‘].+)$/);
  if (!match || !isQuotedInstructionIntro(match[1])) {
    return null;
  }

  const quoteParts = splitLeadingQuote(match[2]);
  if (!quoteParts) {
    return null;
  }

  const parts = quotedInstructionParts(match[1], quoteParts.quote);
  return {
    ...parts,
    quote: quoteParts.quote,
    rest: quoteParts.rest || undefined,
  };
}

export function parseCanonicalQuotedInstructionLine(line: string): CanonicalQuotedInstruction | null {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return null;
  }

  const embedded = trimmed.match(/^(.+?[.!?])\s+(.{1,180}?:\s*)(["'“‘].+)$/);
  if (embedded && isQuotedInstructionIntro(embedded[2])) {
    const quoteParts = splitLeadingQuote(embedded[3]);
    if (quoteParts) {
      const parts = quotedInstructionParts(embedded[2], quoteParts.quote);
      const prefix = [embedded[1].trim(), parts.prefix].filter(Boolean).join(' ');
      return {
        ...parts,
        prefix,
        quote: quoteParts.quote,
        rest: quoteParts.rest || undefined,
      };
    }
  }

  return parseInlineInstruction(trimmed);
}
