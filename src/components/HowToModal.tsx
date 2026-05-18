import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/colors';
import ThemedText from './common/ThemedText';
import { useTheme } from '../theme/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

interface HowToModalProps {
  visible: boolean;
  actionTitle: string;
  actionNumber?: number;
  onDismiss: () => void;
  onSubmit: (question: string) => Promise<{ success: boolean; wisdom?: string; error?: string; message?: string; wisdomCount?: number; wisdomLimit?: number; currentTier?: string; canUpgrade?: boolean }>;
  onThreadUpdate?: (entry: { question: string; wisdom: string }) => void;
  onJournalPress?: (context: { question: string; wisdom: string; actionTitle: string; type: 'reflection' | 'prayer' | 'gratitude' | 'timeblock' }) => void;
  wisdomCount: number;
  wisdomLimit: number;
}

type JournalModalType = 'reflection' | 'prayer' | 'gratitude' | 'timeblock' | null;
const JOURNAL_ICON_ROW_HEIGHT = 78;

const JOURNAL_ICONS: { type: Exclude<JournalModalType, null>; icon: string; color: string; label: string }[] = [
  { type: 'reflection', icon: 'feather', color: Colors.faithGold, label: 'Journal' },
  { type: 'prayer', icon: 'hands-pray', color: '#87CEEB', label: 'Pray' },
  { type: 'gratitude', icon: 'heart', color: Colors.alertCoral, label: 'Gratitude' },
  { type: 'timeblock', icon: 'clock', color: Colors.growthGreen, label: 'Schedule' },
];

type BodyLineType = 'intro' | 'quote' | 'script' | 'choice' | 'bullet' | 'checklistItem' | 'field' | 'check' | 'hint' | 'resourceList' | 'columns' | 'scriptureRead' | 'lineMeaning' | 'ask' | 'question' | 'checklist' | 'body';

interface BodyLine {
  text: string;
  type: BodyLineType;
  label?: string;
  items?: string[];
  columns?: Array<{ title: string; items: string[] }>;
  reference?: string;
  summary?: string;
}

function ScriptRail(): React.ReactElement {
  return (
    <View style={styles.bodyScriptRail} pointerEvents="none">
      <View style={styles.bodyScriptRailCap} />
      <View style={styles.bodyScriptRailLine} />
      <View style={styles.bodyScriptRailCap} />
    </View>
  );
}

function capitalizeFirstLetter(text: string): string {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
}

function isActionApostrophe(text: string, index: number): boolean {
  const char = text[index];
  if (char !== "'" && char !== '‘' && char !== '’') { return false; }
  return /[A-Za-z0-9]/.test(text[index - 1] || '') && /[A-Za-z0-9]/.test(text[index + 1] || '');
}

function stripBalancedActionQuotes(text: string): string {
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

  // Strip commas before periods, exclamation marks, or question marks
  out = out.replace(/,\s*([.!?])/g, '$1');

  return out;
}

function isQuotedActionLine(line: string): boolean {
  return /^["\u201C\u201D]/.test(line.trim());
}

function isScriptIntroLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^(?:say|explain|add|practice\s+saying(?:\s+calmly)?)\s*:\s*$/i.test(trimmed)) {
    return true;
  }
  return /^(?:(?:say|send|text|message|write|ask|pray|request|reply)\b|.*\b(?:with this message|add this request|this request|reply|answer honestly like this|say aloud|say out loud|pause and say aloud|say plainly|say this(?: clearly| plainly)?|pray briefly with these words)\b)[^:]{0,100}:\s*$/i.test(trimmed)
    && /\b(?:this|message|text|script|plainly|aloud|words?|reply|sentence|prayer|ask|request)\b/i.test(trimmed);
}

function scriptLabelForIntro(line: string): string {
  if (/^explain\s*:/i.test(line.trim())) {
    return 'Explain';
  }
  if (/^add\s*:/i.test(line.trim())) {
    return 'Add this point';
  }
  if (/^practice\s+saying\s+calmly\s*:/i.test(line.trim())) {
    return 'Practice saying calmly';
  }
  if (/^say\s*:/i.test(line.trim())) {
    return 'Say';
  }
  if (/\brequest\b/i.test(line)) {
    return 'Request to add';
  }
  if (/\banswer\s+honestly\b/i.test(line)) {
    return 'Honest answer';
  }
  if (/\bfor\s+example\b/i.test(line) && /\bwrite\b/i.test(line)) {
    return 'Example to write';
  }
  if (/\bsay\s+to\s+yourself\b/i.test(line)) {
    return 'Say to yourself';
  }
  if (/\breply\b/i.test(line)) {
    return 'Reply';
  }
  if (/\bpray\b/i.test(line) && /\bbriefly\b/i.test(line)) {
    return 'Brief prayer';
  }
  if (/\bsay\s+plainly\b/i.test(line)) {
    return 'Say plainly';
  }
  if (/\bsay\s+(?:out\s+loud|aloud)\s+with\s+conviction\b/i.test(line)) {
    return 'Say with conviction';
  }
  if (/\bsay\s+aloud\s+clearly\b/i.test(line)) {
    return 'Say aloud clearly';
  }
  if (/\beach\s+morning\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Each morning say aloud';
  }
  if (/\beach\s+(?:day|night|evening)\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Say aloud daily';
  }
  if (/\bwhen\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Say this when it rises';
  }
  if (/\bsay\s+aloud\b/i.test(line)) {
    return 'Say aloud';
  }
  if (/\b(?:message|text|send|reply)\b/i.test(line)) {
    return 'Suggested message';
  }
  if (/\b(?:pray|prayer)\b/i.test(line)) {
    return 'Prayer to say';
  }
  return 'Words to say';
}

function isChecklistIntroLine(line: string): boolean {
  return /^(?:do this(?:\s+(?:each|every)\s+(?:day|morning|evening|night|week))?|steps to take|action steps):\s*$/i.test(line.trim());
}

function isAskPromptIntroLine(line: string): boolean {
  return /^(?:(?:read|rad) slow(?:ly|ely)(?:\s+(?:each day|daily))? and ask|pause and ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|then ask|test|check):\s*$/i.test(line.trim());
}

function askPromptLabel(line: string): string {
  const trimmed = line.trim();
  if (/\bask\s+these\s+questions\b/i.test(trimmed)) {
    return 'Ask these questions';
  }
  if (/^(?:read|rad) slow(?:ly|ely)(?:\s+(?:each day|daily))? and ask/i.test(trimmed)) {
    return 'Read slowly and ask';
  }
  if (/^(?:read|rad) slow(?:ly|ely)\s+(?:each day|daily)/i.test(trimmed)) {
    return 'Read slowly each day';
  }
  if (/^pause and ask/i.test(trimmed)) {
    return 'Pause and ask';
  }
  if (/^ask\s+them/i.test(trimmed)) {
    return 'Ask them';
  }
  if (/^then ask/i.test(trimmed)) {
    return 'Then ask';
  }
  if (/^test/i.test(trimmed)) {
    return 'Test';
  }
  if (/^check/i.test(trimmed)) {
    return 'Check';
  }
  return 'Ask yourself';
}

function isCheckInLabelValueLine(line: string): { label: string; text: string } | null {
  const match = line.match(/^([^:\n]{3,72}):\s*(.+)$/);
  if (!match) {
    return null;
  }

  const label = match[1].trim();
  const text = match[2].trim();
  if (!label || !text || /^example$/i.test(label) || isScriptIntroLine(`${label}:`)) {
    return null;
  }

  const looksLikeCheckIn =
    /^(?:today|areas?|what|where|when|who|why|how|wins?|setbacks?|progress|notes?|action|fear|lie|truth|helped|next|specifics?|journal|discipline|temptation|response|replacement)\b/i.test(label) ||
    /^(?:yes\s*\/\s*no|list\b|note\b|name\b|choose\b|write\b|fill\b|mark\b|track\b|specifics?\b)/i.test(text);

  return looksLikeCheckIn ? { label, text } : null;
}

function getWriteDownActionText(line: string): string | null {
  const match = String(line || '').trim().match(/^(?:write\s+(?:this\s+)?down|jot\s+(?:this\s+)?down|note\s+this):\s*(.+)$/i);
  const text = match?.[1]?.trim();
  return text || null;
}

function parentheticalHintLabelForMain(main: string): string {
  return /\b(?:limit|limits|boundary|boundaries|off-limits|allowed|forbidden|rules?)\b/i.test(main)
    ? 'Possible limits'
    : 'Suggestions';
}

function displayHintLabel(label: string | undefined, itemCount = 2): string {
  const normalized = String(label || '').trim();
  const singular = itemCount === 1;

  if (/^(?:suggestions?|examples?)$/i.test(normalized)) {
    return singular ? 'Suggestion' : 'Suggestions';
  }
  if (/^(?:possible\s+limits?|limit\s+examples?)$/i.test(normalized)) {
    return singular ? 'Possible limit' : 'Possible limits';
  }
  if (/^daily\s+supports?$/i.test(normalized)) {
    return singular ? 'Daily support' : 'Daily supports';
  }

  return normalized || (singular ? 'Suggestion' : 'Suggestions');
}

function splitHintDisplayItems(text: string): string[] {
  return String(text || '')
    .replace(/,\s*([.!?])/g, '$1')
    .split(/\s*(?:;|,)\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

function splitListHintItems(value: string): string[] {
  return String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+plus\s+(?=(?:check-ins?|accountability|prayer|healthy|rest|meals|Bible|waking)\b)/gi, ', ')
    .replace(/\s+and\s+(?=(?:avoiding|avoid|no|prayer|healthy|rest|attending|meeting|meals|places|people)\b)/gi, ', ')
    .replace(/,\s*([.!?])/g, '$1')
    .split(/\s*,\s*/)
    .map(part => {
      const cleaned = part.trim().replace(/^(?:and|or)\s+/i, '').replace(/[.!?]+$/g, '');
      if (/^["“]/.test(cleaned)) {
        return `"${stripBalancedActionQuotes(cleaned)}"`;
      }
      return stripBalancedActionQuotes(cleaned);
    })
    .filter(Boolean);
}

function splitResourceListItems(value: string): string[] {
  const items: string[] = [];
  let current = '';
  let parenDepth = 0;
  let quoteClose = '';
  const source = String(value || '').trim().replace(/[.!?]+$/g, '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoteClose) {
      current += char;
      if (char === quoteClose && !isActionApostrophe(source, i)) {
        quoteClose = '';
      }
      continue;
    }

    if ((char === '"' || char === "'" || char === '“' || char === '‘') && !isActionApostrophe(source, i)) {
      quoteClose = char === '“' ? '”' : char === '‘' ? '’' : char;
      current += char;
      continue;
    }

    if (char === '(') {
      parenDepth++;
    } else if (char === ')' && parenDepth > 0) {
      parenDepth--;
    }

    if ((char === ',' || char === ';') && parenDepth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items
    .map(item => stripBalancedActionQuotes(item.replace(/^(?:and|or)\s+/i, '').trim()))
    .filter(Boolean);
}

function parseResourceListLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(.{0,120}?\b(?:including|include|list|consider|choose from)\b[^:]{0,90}\b(?:materials?|resources?|studies|books|curricula|curriculum|options)\b[^:]*):\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const items = splitResourceListItems(match[2]);
  if (items.length < 2) {
    return null;
  }

  return {
    label: /material/i.test(match[1]) ? 'Materials to consider' : 'Resources to consider',
    text: match[1].trim().replace(/:\s*$/, '.'),
    type: 'resourceList',
    items,
  };
}

function parseResourceHintLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(?:Suggestion|Suggestions|Example|Examples):\s*(?:(?:these|the)\s+)?(materials?|resources?|studies|books|curricula|curriculum|options)\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const items = splitResourceListItems(match[2]);
  if (items.length < 2) {
    return null;
  }

  return {
    label: /material/i.test(match[1]) ? 'Materials to consider' : 'Resources to consider',
    text: 'Make a list from these options.',
    type: 'resourceList',
    items,
  };
}

function splitComparisonColumnItems(value: string): string[] {
  const source = String(value || '').trim().replace(/[.!?]+$/g, '');

  // Try splitting by numbered format like "1) item; 2) item; 3) item"
  const numberedParts = source
    .split(/(?<=\))\s*;\s*/)
    .map(part => part.replace(/^\s*\d+\)\s*/, '').trim())
    .filter(Boolean);

  if (numberedParts.length >= 2) {
    return numberedParts;
  }

  // Try splitting by semicolons followed by numbers/bullets
  const semicolonNumberedParts = source
    .split(/\s*;\s*(?=\d+\)|[-*•]\s+)/)
    .map(part => part.replace(/^\s*(?:\d+\)|[-*•])\s*/, '').trim())
    .filter(Boolean);

  if (semicolonNumberedParts.length >= 2) {
    return semicolonNumberedParts;
  }

  // Fallback to simple semicolon split
  return source
    .split(/\s*;\s*/)
    .map(part => part.replace(/^\s*(?:\d+\)|[-*•])\s*/, '').trim())
    .filter(Boolean);
}

function parseComparisonColumnLine(line: string): { title: string; items: string[] } | null {
  const match = String(line || '').trim().match(/^Under\s+["'“‘]?([^"'”’]+?)["'”’]?,?\s+list\s+(?:(?:these|this)\s+)?(?:points?|items?|teachings?|truths?|beliefs?)(?:\s+with\s+[^:]+)?\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const title = stripBalancedActionQuotes(match[1].trim().replace(/,\s*$/, ''));
  const items = splitComparisonColumnItems(match[2]);
  return title && items.length > 0 ? { title, items } : null;
}

function parseScriptureReadLine(line: string): BodyLine | null {
  const trimmed = String(line || '').trim();
  const scriptureOnlyMatch = trimmed.match(/^(?:Scripture|Passage)\s+(.{2,120}?):\s*["'“‘](.+)["'”’]?$/i)
    || trimmed.match(/^(?:Scripture|Passage)\s+(.{2,120}?):\s*(.+)$/i);
  if (scriptureOnlyMatch) {
    const reference = scriptureOnlyMatch[1].trim();
    const verseText = stripBalancedActionQuotes(scriptureOnlyMatch[2].trim());
    if (!reference || !verseText) {
      return null;
    }

    return {
      text: verseText,
      type: 'scriptureRead',
      reference,
    };
  }

  const match = trimmed.match(/^Read\s+(.{2,100}?):\s*["'“‘](.+?)["'”’]?\s+Write:\s*(.+)$/i)
    || trimmed.match(/^Read\s+(.{2,100}?):\s*(.+?)\s+Write:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const reference = match[1].trim();
  const verseText = stripBalancedActionQuotes(match[2].trim());
  const summary = match[3].trim();
  if (!reference || !verseText || !summary) {
    return null;
  }

  return {
    text: verseText,
    type: 'scriptureRead',
    reference,
    summary,
  };
}

function parseLineMeaningLine(line: string): BodyLine | null {
  const match = String(line || '').trim().match(/^(?:Line|Phrase|Verse\s*\d*)\s*:\s*["'“‘]?(.+?)["'”’]?\s+(?:Means|Meaning|Explanation)\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const phrase = stripBalancedActionQuotes(match[1].trim());
  const meaning = match[2].trim();
  if (!phrase || !meaning) {
    return null;
  }

  return {
    text: phrase,
    type: 'lineMeaning',
    summary: meaning,
  };
}

function extractParentheticalActionHint(value: string): { main: string; hints: string[]; label: string } | null {
  const match = String(value || '').trim().match(/^(.+?)\s*\((?:e\.g\.,?\s*)?([^)]+)\)([.!?])?$/i);
  if (!match) {
    return null;
  }

  const main = match[1].trim();
  const hints = splitListHintItems(match[2]);
  if (!main || hints.length === 0) {
    return null;
  }

  return {
    main: /[.!?]$/.test(main) ? main : `${main}${match[3] || ''}`,
    hints,
    label: displayHintLabel(parentheticalHintLabelForMain(main), hints.length),
  };
}

function splitQuestionPromptText(value: string): string[] {
  const questions = String(value || '')
    .split(/(?<=\?)\s+(?=\S)/)
    .map(part => part.trim())
    .filter(Boolean);
  return questions.length > 0 ? questions : [String(value || '').trim()].filter(Boolean);
}

function splitHintTextFromTrailingInstruction(value: string): { hintText: string; trailingText: string } {
  const parts = String(value || '')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { hintText: String(value || '').trim(), trailingText: '' };
  }

  const firstInstructionIndex = parts.findIndex((part, index) => {
    if (index === 0) {
      return false;
    }
    return /^(?:Evaluate|Decide|Choose|Compare|Review|Then|Next|After|Ask|Write|Use|Pick|Select|Note|Share|Bring|Schedule|Contact|Message|Practice|Repeat|Set)\b/i.test(part);
  });

  if (firstInstructionIndex < 1) {
    return { hintText: String(value || '').trim(), trailingText: '' };
  }

  return {
    hintText: parts.slice(0, firstInstructionIndex).join(' '),
    trailingText: parts.slice(firstInstructionIndex).join(' '),
  };
}

function splitLeadingQuotedActionText(value: string): { quote: string; rest: string } {
  const source = String(value || '').trim();
  const open = source[0];
  if (open !== '"' && open !== '“' && open !== "'" && open !== '‘') {
    return { quote: source, rest: '' };
  }

  const close = open === '“' ? '”' : open === '‘' ? '’' : open;
  for (let i = 1; i < source.length; i++) {
    if (source[i] === close && source[i - 1] !== '\\' && !isActionApostrophe(source, i)) {
      const rawQuote = source.slice(0, i + 1).trim();
      const quote = open === "'" || open === '‘'
        ? `"${stripBalancedActionQuotes(rawQuote)}"`
        : rawQuote;
      return {
        quote,
        rest: source.slice(i + 1).trim(),
      };
    }
  }

  return { quote: source, rest: '' };
}

function splitParentheticalActionHint(line: string): string[] | null {
  const trimmed = String(line || '').trim();
  const match = trimmed.match(/^(.+?)\s*\((?:e\.g\.,?\s*)?([^)]+)\)([.!?])?(?:\s+(.+))?$/i);
  if (!match) {
    return null;
  }

  const main = match[1].trim();
  const hintItems = splitListHintItems(match[2]);
  if (!main || hintItems.length === 0) {
    return null;
  }

  const mainLine = /[.!?]$/.test(main) ? main : `${main}${match[3] || '.'}`;
  const hintLabel = displayHintLabel(parentheticalHintLabelForMain(main), hintItems.length);
  const trailingLines = match[4] ? splitReadableActionLine(match[4].trim()) : [];

  return [mainLine, `${hintLabel}: ${hintItems.join('; ')}`, ...trailingLines];
}

function splitSuchAsActionHint(line: string): string[] | null {
  const trimmed = String(line || '').trim();
  const match = trimmed.match(/^(.+?)\s+(?:such as|including)\s+(.+?)([.!?])?$/i);
  if (!match) {
    return null;
  }

  const main = match[1].trim();
  const { hintText, trailingText } = splitHintTextFromTrailingInstruction(match[2]);
  const hintItems = splitListHintItems(hintText);
  if (!main || hintItems.length < 2) {
    return null;
  }

  const mainLine = /[.!?]$/.test(main) ? main : `${main}${match[3] || '.'}`;
  const rawHintLabel = /\b(?:daily|each day|sober|sobriety|recovery|habit|plan|schedule)\b/i.test(main)
    ? 'Daily supports'
    : 'Suggestions';
  const hintLabel = displayHintLabel(rawHintLabel, hintItems.length);

  return [mainLine, `${hintLabel}: ${hintItems.join('; ')}`, ...splitReadableActionLine(trailingText)];
}

function splitInlineQuotedExamples(line: string): string[] | null {
  const trimmed = String(line || '').trim();
  const likeMatch = trimmed.match(/^(.+?)\s+(?:like|such as)\s+["'“‘](.+?)["'”’]\s+(?:or|and)\s+["'“‘](.+?)["'”’]([.!?])?$/i);
  if (likeMatch) {
    const main = likeMatch[1].trim();
    return [
      /[.!?]$/.test(main) ? main : `${main}${likeMatch[4] || '.'}`,
      `Suggestions: ${likeMatch[2].trim()}; ${likeMatch[3].trim()}`,
    ];
  }

  const insteadMatch = trimmed.match(/^(.+?)\s+for example,\s+["'“‘](.+?)["'”’]\s+instead of\s+["'“‘](.+?)["'”’]([.!?])?$/i);
  if (insteadMatch) {
    const main = insteadMatch[1].trim();
    return [
      /[.!?]$/.test(main) ? main : `${main}${insteadMatch[4] || '.'}`,
      `Use this kind of goal: ${insteadMatch[2].trim()}`,
      `Avoid outcome pressure: ${insteadMatch[3].trim()}`,
    ];
  }

  return null;
}

function splitReadableActionLine(line: string): string[] {
  const trimmed = line
    .trim()
    .replace(/([.!?]["'”’])\s*,\s*["'“‘]\s*(?=(?:If|When|After|Then)\b)/gi, '$1 ')
    .replace(/(["”’])\s*,\s*["'“‘]\s*(?=(?:If|When|After|Then)\b)/gi, '$1 ');
  if (!trimmed) { return []; }
  if (parseScriptureReadLine(trimmed) || parseLineMeaningLine(trimmed)) { return [trimmed]; }
  if (/^(?:\*|-|•|\+) /.test(trimmed)) { return [trimmed.replace(/^(?:-|•|\+) /, '* ')]; }
  if (/^(?:Trigger|Lie|Temptation|Replacement response|Replacement|Practice|Stop|Start):\s+/i.test(trimmed)) { return [trimmed]; }
  if (parseComparisonColumnLine(trimmed)) { return [trimmed]; }
  const embeddedScript = trimmed.match(/^(.+?[.!?])\s+(.{0,140}?\b(?:reach out(?: today)? with this message|with this message|add this request|this request|answer honestly like this|for example,\s*write|say to yourself|pause and say aloud|say aloud|say out loud|say plainly|say this(?: clearly| plainly)?|send(?: this)? message|message|text|write|ask|request|reply|pray(?:\s+briefly)?(?:\s+with\s+these\s+words)?)\b[^:]{0,70}:\s*)(["'\u201C\u2018].+)$/i);
  if (embeddedScript) {
    const { quote, rest } = splitLeadingQuotedActionText(embeddedScript[3]);
    return [
      embeddedScript[1].trim(),
      embeddedScript[2].trim(),
      quote,
      ...splitReadableActionLine(rest),
    ];
  }
  const unquotedSpokenLine = trimmed.match(/^(.{0,140}?\b(?:say(?:\s+aloud(?:\s+slowly\s+and\s+clearly)?)?|explain|add|practice\s+saying(?:\s+calmly)?|repeat\s+the\s+next\s+declaration|for example)\b[^:]{0,70}:\s*)([A-Z][^"'\u201C\u2018].+)$/i);
  if (unquotedSpokenLine) {
    const statement = unquotedSpokenLine[2].trim();
    return [
      unquotedSpokenLine[1].trim(),
      `"${statement.replace(/[.!?]$/g, '')}."`,
    ];
  }
  const inlineScript = trimmed.match(/^(.{0,170}?\b(?:reach out(?: today)? with this message|with this message|add this request|this request|answer honestly like this|for example,\s*write|say to yourself|pause and say aloud|say aloud|say out loud|say plainly|say this(?: clearly| plainly)?|send(?: this)? message|message|text|write|ask|request|reply|pray(?:\s+briefly)?(?:\s+with\s+these\s+words)?)\b[^:]{0,70}:\s*)(["'\u201C\u2018].+)$/i);
  if (inlineScript) {
    const { quote, rest } = splitLeadingQuotedActionText(inlineScript[2]);
    return [inlineScript[1].trim(), quote, ...splitReadableActionLine(rest)];
  }
  const embeddedQuestionPrompt = trimmed.match(/^(.+?[.!?])\s+((?:(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|test|check)\s*:\s*)(.+)$/i);
  if (embeddedQuestionPrompt) {
    return [
      embeddedQuestionPrompt[1].trim(),
      capitalizeFirstLetter(embeddedQuestionPrompt[2].trim()),
      ...splitQuestionPromptText(embeddedQuestionPrompt[3]),
    ];
  }
  const embeddedLooseQuestionPrompt = trimmed.match(/^(.+?)\s+((?:(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|test|check)\s*:\s*)(.+)$/i);
  if (embeddedLooseQuestionPrompt && embeddedLooseQuestionPrompt[1].trim().length > 8) {
    return [
      ...splitReadableActionLine(embeddedLooseQuestionPrompt[1].trim()),
      capitalizeFirstLetter(embeddedLooseQuestionPrompt[2].trim()),
      ...splitQuestionPromptText(embeddedLooseQuestionPrompt[3]),
    ];
  }
  const questionPrompt = trimmed.match(/^((?:(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|[^:]{0,90}\bask\s+these\s+questions|ask(?:\s+(?:yourself|them))?(?:\s+these\s+questions)?|test|check)\s*:\s*)(.+)$/i);
  if (questionPrompt) {
    return [
      capitalizeFirstLetter(questionPrompt[1].trim()),
      ...splitQuestionPromptText(questionPrompt[2]),
    ];
  }
  const followUpInstruction = trimmed.match(/^(.+?[.!?]["'”’])\s+((?:If|When|After|Then|Repeat)\b.+)$/i);
  if (followUpInstruction) {
    return [
      ...splitReadableActionLine(followUpInstruction[1].trim()),
      ...splitReadableActionLine(followUpInstruction[2].trim()),
    ];
  }
  if (/^["\u201C]/.test(trimmed)) { return [trimmed]; }

  const sentenceParts = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z"“])|(?<=[.!?]["'”’])\s+(?=[A-Z])/)
    .map(part => part.trim())
    .filter(Boolean);
  if (sentenceParts.length >= 2 && sentenceParts.some(part => isAskPromptIntroLine(part))) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (sentenceParts.length >= 2 && sentenceParts.some(part => isChecklistIntroLine(part))) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (sentenceParts.length >= 2 && sentenceParts.some(part => /^(?:If|When|After)\b/i.test(part))) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }
  if (
    sentenceParts.length >= 2 &&
    sentenceParts.some(part => /\([^)]+\)/.test(part) || /^Then\b/i.test(part))
  ) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }

  const parentheticalHint = splitParentheticalActionHint(trimmed);
  if (parentheticalHint) {
    return parentheticalHint;
  }

  const suchAsHint = splitSuchAsActionHint(trimmed);
  if (suchAsHint) {
    return suchAsHint;
  }

  const inlineExamples = splitInlineQuotedExamples(trimmed);
  if (inlineExamples) {
    return inlineExamples;
  }

  if (trimmed.length < 145) { return [trimmed]; }

  return sentenceParts.length >= 2 ? sentenceParts : [trimmed];
}

function normalizeActionMarkup(text: string): string {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<p\s*>/gi, '')
    .replace(/<\/?.[^>]+>/g, '')
    .replace(/\s+(?=\d+(?:\.\d+)?[.)]\s+(?:Say|Explain|Add|Practice|Write|Read|Ask|Use|Share|Tell|Send|Text|List|Choose|Start|Stop|Notice|Remember|Then|Next|If|When|After)\b)/gi, '\n')
    .replace(/,\s*([.!?])/g, '$1');
}

function normalizeActionBulletMarkers(text: string): string {
  return String(text || '')
    .split('\n')
    .map(line => {
      if (/^\s*(?:\d+(?:\.\d+)?[.)]\s*)?(?:Scripture|Passage)\s+.{2,120}:\s*/i.test(line)) {
        return line;
      }

      return line
        .replace(/([^*\n]{1,90}:\s*)\*\s*/g, (_match, label) => `${String(label).trimEnd()}\n* `)
        .replace(/([^\n])\s*\*\s*(?=\S)/g, '$1\n* ')
        .replace(/([a-z)\]"”])\s*(Example(?:\s+(?:entry|prayer|message|text|words|script|sentence|phrase|loop|action|question|questions))?\s*[:：])/g, '$1\n$2')
        .replace(/^(\s*)[-•+]\s+/, '$1* ');
    })
    .join('\n');
}

function cleanWisdomDisplayText(value: string): string {
  if (!value) {
    return '';
  }
  return value
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/,\s*([.!?])/g, '$1')
    .trim();
}

function renderResourceListBlock(item: BodyLine, key: string | number): React.ReactElement {
  return (
    <View key={key} style={styles.bodyResourceBlock}>
      {item.text ? (
        <ThemedText style={styles.bodyResourceIntro} selectable={true}>
          {item.text}
        </ThemedText>
      ) : null}
      <View style={styles.bodyResourceHeader}>
        <Ionicons name="library-outline" size={13} color="rgba(255,204,102,0.78)" />
        <ThemedText weight="semiBold" style={styles.bodyResourceLabel} selectable={true}>
          {item.label || 'Resources to consider'}
        </ThemedText>
      </View>
      <View style={styles.bodyResourceList}>
        {(item.items || []).map(resource => (
          <View key={resource} style={styles.bodyResourceItemRow}>
            <View style={styles.bodyResourceItemDot} />
            <ThemedText style={styles.bodyResourceItemText} selectable={true}>
              {resource}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderComparisonColumnsBlock(item: BodyLine, key: string | number): React.ReactElement {
  const columns = (item.columns || []).slice(0, 3);
  if (columns.length === 0 || columns.every(column => column.items.length === 0)) {
    return (
      <ThemedText key={key} style={styles.wisdomText} selectable={true}>
        {item.text}
      </ThemedText>
    );
  }

  return (
    <View key={key} style={styles.bodyColumnsBlock}>
      {columns.map(column => (
        <View key={column.title} style={styles.bodyColumnCard}>
          <View style={styles.bodyColumnHeader}>
            <ThemedText weight="semiBold" style={styles.bodyColumnHeaderText} selectable={true}>
              {column.title}
            </ThemedText>
          </View>
          <View style={styles.bodyColumnList}>
            {column.items.map((columnItem, itemIndex) => (
              <View key={`${column.title}-${itemIndex}`} style={styles.bodyColumnItemRow}>
                <View style={styles.bodyColumnItemNumber}>
                  <ThemedText weight="semiBold" style={styles.bodyColumnItemNumberText} selectable={true}>
                    {itemIndex + 1}
                  </ThemedText>
                </View>
                <ThemedText style={styles.bodyColumnItemText} selectable={true}>
                  {columnItem}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function renderScriptureReadBlock(item: BodyLine, key: string | number): React.ReactElement {
  return (
    <View key={key} style={styles.bodyScriptureReadBlock}>
      <View style={styles.bodyScriptureReadHeader}>
        <MaterialCommunityIcons name="script-text" size={14} color={Colors.faithGold} />
        <ThemedText weight="semiBold" style={styles.bodyScriptureReadReference} selectable={true}>
          {item.reference}
        </ThemedText>
      </View>
      <View style={styles.bodyScriptureReadQuoteRow}>
        <View style={styles.bodyScriptureReadRail} />
        <ThemedText style={styles.bodyScriptureReadText} selectable={true}>
          {item.text}
        </ThemedText>
      </View>
      {item.summary ? (
        <View style={styles.bodyScriptureReadSummary}>
          <ThemedText weight="semiBold" style={styles.bodyScriptureReadSummaryLabel} selectable={true}>
            Write
          </ThemedText>
          <ThemedText style={styles.bodyScriptureReadSummaryText} selectable={true}>
            {item.summary}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function renderLineMeaningBlock(item: BodyLine, key: string | number): React.ReactElement {
  return (
    <View key={key} style={styles.bodyLineMeaningBlock}>
      <View style={styles.bodyScriptureReadQuoteRow}>
        <View style={styles.bodyScriptureReadRail} />
        <ThemedText style={styles.bodyLineMeaningPhrase} selectable={true}>
          {item.text}
        </ThemedText>
      </View>
      {item.summary ? (
        <View style={styles.bodyLineMeaningSummary}>
          <ThemedText weight="semiBold" style={styles.bodyScriptureReadSummaryLabel} selectable={true}>
            Meaning
          </ThemedText>
          <ThemedText style={styles.bodyScriptureReadSummaryText} selectable={true}>
            {item.summary}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function detectBodyLines(lines: string[]): BodyLine[] {
  const out: BodyLine[] = [];
  let expectingPromptQuestion = false;
  let inChecklist = false;
  let inWriteDownList = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    const nextLine = lines[idx + 1]?.trim() || '';
    const resourceList = parseResourceListLine(line) || parseResourceHintLine(line);
    const comparisonColumn = parseComparisonColumnLine(line);
    const scriptureRead = parseScriptureReadLine(line);
    const lineMeaning = parseLineMeaningLine(line);

    if (scriptureRead) {
      out.push(scriptureRead);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (lineMeaning) {
      out.push(lineMeaning);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (comparisonColumn) {
      const columns = [comparisonColumn];
      let cursor = idx + 1;
      while (cursor < lines.length) {
        const nextColumn = parseComparisonColumnLine(lines[cursor]?.trim() || '');
        if (!nextColumn) {
          break;
        }
        columns.push(nextColumn);
        cursor++;
      }

      out.push({
        text: 'Compare these side by side.',
        type: 'columns',
        columns,
      });
      idx = cursor - 1;
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (resourceList) {
      out.push(resourceList);
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (isScriptIntroLine(line) && isQuotedActionLine(nextLine)) {
      out.push({
        label: scriptLabelForIntro(line),
        text: stripBalancedActionQuotes(nextLine),
        type: 'script',
      });
      idx++;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (/^(?:\*|-|•) /.test(line)) {
      out.push({
        text: line.replace(/^(?:\*|-|•) /, '').trim(),
        type: inChecklist ? 'checklistItem' : 'bullet',
      });
      expectingPromptQuestion = false;
      inWriteDownList = false;
      continue;
    }

    if (isAskPromptIntroLine(line)) {
      out.push({ label: askPromptLabel(line), text: '', type: 'ask' });
      expectingPromptQuestion = true;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (expectingPromptQuestion && line.endsWith('?')) {
      out.push({ text: line, type: 'question' });
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (isChecklistIntroLine(line)) {
      out.push({ label: 'Do this', text: '', type: 'checklist' });
      expectingPromptQuestion = false;
      inChecklist = true;
      inWriteDownList = false;
      continue;
    }

    const writeDownText = getWriteDownActionText(line);
    if (writeDownText) {
      if (!inWriteDownList) {
        out.push({ label: 'Write this down', text: '', type: 'checklist' });
      }
      out.push({ text: writeDownText, type: 'checklistItem' });
      expectingPromptQuestion = false;
      inChecklist = true;
      inWriteDownList = true;
      continue;
    }

    if (line.endsWith(':') && line.length < 90) {
      out.push({ text: line, type: 'intro' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    if (isQuotedActionLine(line)) {
      out.push({ text: line, type: 'quote' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const hintMatch = line.match(/^(Suggestions|Examples|Possible limits|Limit examples|Daily supports):\s*(.+)$/i);
    if (hintMatch) {
      const { hintText, trailingText } = splitHintTextFromTrailingInstruction(hintMatch[2]);
      out.push({ label: capitalizeFirstLetter(hintMatch[1].trim()), text: hintText, type: 'hint' });
      if (trailingText) {
        out.push(...detectBodyLines(splitReadableActionLine(trailingText)));
      }
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const fieldMatch = line.match(/^(Trigger|Lie|Temptation|Replacement response|Replacement|Practice(?: saying calmly)?|Say|Explain|Add|Stop|Start|Declaration|Use this kind of goal|Avoid outcome pressure):\s*(.+)$/i);
    if (fieldMatch) {
      const label = fieldMatch[1]
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/^Replacement(?: Response)?$/i, 'Response')
        .replace(/^Practice Saying Calmly$/i, 'Practice calmly');
      out.push({ label, text: fieldMatch[2].trim(), type: 'field' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    const checkInLine = isCheckInLabelValueLine(line);
    if (checkInLine) {
      out.push({ label: checkInLine.label, text: checkInLine.text, type: 'check' });
      expectingPromptQuestion = false;
      inChecklist = false;
      inWriteDownList = false;
      continue;
    }

    out.push({ text: line, type: 'body' });
    expectingPromptQuestion = false;
    inChecklist = false;
    inWriteDownList = false;
  }

  return out;
}


const HowToModal: React.FC<HowToModalProps> = ({
  visible,
  actionTitle,
  actionNumber,
  onDismiss,
  onSubmit,
  onThreadUpdate,
  onJournalPress,
  wisdomCount,
  wisdomLimit,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const theme = useTheme();
  const font = React.useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  const [question, setQuestion] = useState('');
  const [resultQuestion, setResultQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; wisdom?: string; error?: string; message?: string; wisdomCount?: number; wisdomLimit?: number; currentTier?: string; canUpgrade?: boolean } | null>(null);
  const preserveDraftOnCloseRef = React.useRef(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const resultAnim = React.useRef(new Animated.Value(0)).current;
  const loadingAnim = React.useRef(new Animated.Value(1)).current;
  const [dotIndex, setDotIndex] = useState(0);
  const [showStillNeedHelpLabel, setShowStillNeedHelpLabel] = useState(false);
  const stillNeedHelpWidthAnim = React.useRef(new Animated.Value(44)).current;
  const stillNeedHelpTranslateXAnim = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [journalExpanded, setJournalExpanded] = useState(false);
  const triggerRotation = React.useRef(new Animated.Value(0)).current;
  const triggerScale = React.useRef(new Animated.Value(1)).current;
  const iconAnims = React.useRef(JOURNAL_ICONS.map(() => new Animated.Value(0))).current;
  const rowHeight = React.useRef(new Animated.Value(0)).current;
  const rowOpacity = React.useRef(new Animated.Value(0)).current;

  const toggleJournalIcons = React.useCallback(() => {
    const expanding = !journalExpanded;
    setJournalExpanded(expanding);

    if (expanding) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 260);
      Animated.parallel([
        Animated.timing(triggerRotation, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(triggerScale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(rowHeight, { toValue: JOURNAL_ICON_ROW_HEIGHT, duration: 250, useNativeDriver: false }),
        Animated.timing(rowOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start();

      iconAnims.forEach((anim, idx) => {
        Animated.timing(anim, { toValue: 1, duration: 200, delay: idx * 50, useNativeDriver: true }).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(triggerRotation, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(triggerScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(rowHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(rowOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();

      iconAnims.forEach((anim) => {
        Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      });
    }
    triggerLightHaptic();
  }, [journalExpanded, triggerRotation, triggerScale, rowHeight, rowOpacity, iconAnims]);

  const navigateToSalesOffer = React.useCallback((count = wisdomCount, limit = wisdomLimit, currentTier?: string) => {
    const normalizedTier = String(currentTier || '')
      .toLowerCase()
      .replace(/_(?:annual|monthly)$/, '');
    const selectedTier = normalizedTier === 'spark' || normalizedTier === 'growth' || normalizedTier === 'transformation'
      ? normalizedTier
      : undefined;
    preserveDraftOnCloseRef.current = true;
    onDismiss();
    (navigation as any).navigate('OnboardingSalesOffer', {
      upgradeMode: true,
      source: 'wisdom_limit',
      feature: 'wisdom',
      featureType: 'wisdom',
      currentTier,
      tier: currentTier,
      selectedTier,
      dismissBehavior: 'goBack',
      skipNotificationPreference: true,
      testModeRemaining: limit === -1 ? -1 : Math.max(0, limit - count),
      testModeLimit: limit,
    });
  }, [navigation, onDismiss, wisdomCount, wisdomLimit]);


  // Loading animation - pulsing effect like refine modal
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(loadingAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    if (loading) {
      animation.start();
    } else {
      animation.stop();
      loadingAnim.setValue(1);
    }

    return () => {
      animation.stop();
    };
  }, [loading, loadingAnim]);

  // Dot animation for loading state
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (loading) {
      interval = setInterval(() => {
        setDotIndex(prev => (prev + 1) % 3);
      }, 500);
    } else {
      setDotIndex(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [loading]);

  React.useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      resultAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      if (preserveDraftOnCloseRef.current) {
        preserveDraftOnCloseRef.current = false;
      } else {
        setQuestion('');
        setResultQuestion('');
        setResult(null);
      }
      setLoading(false);
    }
  }, [visible, fadeAnim, resultAnim]);

  React.useEffect(() => {
    if (result?.success && result.wisdom) {
      resultAnim.setValue(0);
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [result, resultAnim, visible, fadeAnim]);

  const handleSubmit = async () => {
    if (question.trim().length < 5) {return;}
    const currentQuestion = question.trim();
    triggerLightHaptic();
    setLoading(true);
    setResult(null);
    setResultQuestion('');
    // Force a re-render to ensure loading state is visible
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const response = await onSubmit(currentQuestion);
      if (response.error === 'WISDOM_LIMIT_REACHED') {
        navigateToSalesOffer(response.wisdomCount ?? wisdomCount, response.wisdomLimit ?? wisdomLimit, response.currentTier);
        return;
      }

      if (response.success && response.wisdom) {
        Keyboard.dismiss();
        setResultQuestion(currentQuestion);
      }
      setResult(response);
      if (response.success) {
        if (response.wisdom) {
          onThreadUpdate?.({ question: currentQuestion, wisdom: response.wisdom.trim() });
        }
        triggerSuccessHaptic();
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'ERROR',
        message: 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasWisdom = Boolean(result?.success && result?.wisdom);
  const wisdomBodyLines = React.useMemo(() => {
    if (!result?.wisdom) {
      return [];
    }

    const isDeclarationList = /(?:^|\n)\s*(?:here\s+(?:are|is)\s+)?\d+\s+(?:specific\s+)?(?:trust\s+)?declarations?\b/i.test(result.wisdom);
    const lines = normalizeActionBulletMarkers(normalizeActionMarkup(result.wisdom))
      .split(/\n+/)
      .flatMap(line => {
        const numbered = /^(?:\d+(?:\.\d+)?[.)])\s+/.test(line.trim());
        const cleanedLine = line.replace(/^(?:\d+(?:\.\d+)?[.)])\s+/, '');
        const parts = splitReadableActionLine(cleanedLine);
        return isDeclarationList && numbered
          ? parts.map(part => `Declaration: ${part}`)
          : parts;
      })
      .filter((line): line is string => Boolean(line))
      .map(line => cleanWisdomDisplayText(line))
      .filter(Boolean);

    return detectBodyLines(lines);
  }, [result?.wisdom]);

  const resultTranslateY = resultAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  // Still need help button animation - expand to show label then collapse
  React.useEffect(() => {
    if (result && hasWisdom) {
      Animated.timing(stillNeedHelpWidthAnim, {
        toValue: 160,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowStillNeedHelpLabel(true);
        setTimeout(() => {
          setShowStillNeedHelpLabel(false);
          Animated.timing(stillNeedHelpWidthAnim, {
            toValue: 44,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }, 3000);
      });
    } else {
      stillNeedHelpWidthAnim.setValue(44);
      stillNeedHelpTranslateXAnim.setValue(0);
      setShowStillNeedHelpLabel(false);
    }
  }, [result, hasWisdom, stillNeedHelpWidthAnim, stillNeedHelpTranslateXAnim]);

  if (!visible) {return null;}

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: Colors.anchorBlue }}
      >
        <Animated.View style={[styles.fullScreenContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              preserveDraftOnCloseRef.current = false;
              onDismiss();
            }}
            style={[styles.closeButton, { top: insets.top + 8 }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>

          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + (hasWisdom ? 170 : 100),
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.labelRow}>
              <Ionicons name="help-circle-outline" size={16} color={Colors.alertCoral} />
              <ThemedText weight="semiBold" style={styles.label} selectable={true}>HOW TO</ThemedText>
            </View>
            <View style={styles.titleRow}>
              <ThemedText weight="semiBold" style={styles.prompt} selectable={true}>
                {hasWisdom ? "Here's some wisdom" : 'What do you need help\nwith for this action?'}
              </ThemedText>
            </View>
            <View style={styles.subtextRow}>
              {actionNumber !== undefined && (
                <View style={styles.stepCircle}>
                  <ThemedText weight="bold" style={styles.stepNumber} selectable={true}>{actionNumber}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.subtext} selectable={true}>{actionTitle}</ThemedText>
            </View>

            {result ? (
              <View style={styles.resultContainer}>
                {hasWisdom ? (
                  <>
                    <Animated.View
                      style={[
                        styles.wisdomOutput,
                        {
                          opacity: resultAnim,
                          transform: [{ translateY: resultTranslateY }],
                        },
                      ]}
                    >
                      {wisdomBodyLines.map((item, idx) => {
                        const lineDelay = Math.min(0.62, idx * 0.045);
                        const lineStart = Math.max(0.001, lineDelay);
                        const lineEnd = Math.min(0.96, lineStart + 0.24);
                        const lineOpacity = resultAnim.interpolate({
                          inputRange: [0, lineStart, lineEnd, 1],
                          outputRange: [0, 0, 1, 1],
                          extrapolate: 'clamp',
                        });
                        const lineTranslateY = resultAnim.interpolate({
                          inputRange: [0, lineStart, lineEnd, 1],
                          outputRange: [10, 10, 0, 0],
                          extrapolate: 'clamp',
                        });
                        const content = (() => {
                        if (item.type === 'script') {
                          const isPrayerScript = /\bpray\b/i.test(item.label || '');
                          return (
                            <View key={idx} style={[styles.bodyScriptBlock, isPrayerScript && styles.bodyScriptBlockPrayer]}>
                              <ScriptRail />
                              <View style={styles.bodyScriptHeader}>
                                <Ionicons name="volume-medium-outline" size={13} color={Colors.faithGold} />
                                <ThemedText weight="semiBold" style={styles.bodyScriptLabel} selectable={true}>
                                  {item.label || 'Words to say'}
                                </ThemedText>
                              </View>
                              <ThemedText style={styles.bodyScriptText} selectable={true}>
                                {item.text}
                              </ThemedText>
                            </View>
                          );
                        }
                        if (item.type === 'ask') {
                          return (
                            <View key={idx} style={styles.bodyAskHeader}>
                              <Ionicons name="help-circle-outline" size={14} color="rgba(255,204,102,0.78)" />
                              <ThemedText weight="semiBold" style={styles.bodyAskLabel} selectable={true}>
                                {item.label || 'Ask yourself'}
                              </ThemedText>
                            </View>
                          );
                        }
                        if (item.type === 'question') {
                          return (
                            <View key={idx} style={styles.bodyQuestionRow}>
                              <ThemedText style={styles.bodyQuestionMark} selectable={true}>?</ThemedText>
                              <ThemedText style={styles.bodyQuestionText} selectable={true}>
                                {item.text}
                              </ThemedText>
                            </View>
                          );
                        }
                        if (item.type === 'checklist') {
                          return (
                            <View key={idx} style={styles.bodyChecklistHeader}>
                              <FontAwesome6 name="list-check" size={13} color="rgba(255,204,102,0.78)" />
                              <ThemedText weight="semiBold" style={styles.bodyChecklistLabel} selectable={true}>
                                {item.label || 'Do this'}
                              </ThemedText>
                            </View>
                          );
                        }
                        if (item.type === 'checklistItem') {
                          const bulletHint = extractParentheticalActionHint(item.text);
                          return (
                            <View key={idx} style={styles.bodyChecklistItemRow}>
                              <View style={styles.bodyChecklistItemIcon}>
                                <Ionicons name="checkmark" size={12} color={Colors.faithGold} />
                              </View>
                              <View style={styles.bodyChecklistItemContent}>
                                <ThemedText style={styles.bodyChecklistItemText} selectable={true}>
                                  {bulletHint?.main || item.text}
                                </ThemedText>
                                {bulletHint && (
                                  <View style={styles.bodyInlineHintBlock}>
                                    <View style={styles.bodyHintHeader}>
                                      <Ionicons
                                        name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                                        size={13}
                                        color="rgba(255,204,102,0.72)"
                                      />
                                      <ThemedText weight="semiBold" style={styles.bodyHintLabel} selectable={true}>
                                        {bulletHint.label}
                                      </ThemedText>
                                    </View>
                                    <View style={styles.bodyLineBulletHintRow}>
                                      {bulletHint.hints.map(hint => (
                                        <View key={hint} style={styles.bodyLineBulletHintChip}>
                                          <ThemedText style={styles.bodyLineBulletHintText} selectable={true}>
                                            {hint}
                                          </ThemedText>
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        }
                        if (item.type === 'bullet') {
                          const bulletHint = extractParentheticalActionHint(item.text);
                          return (
                            <View key={idx} style={styles.bodyLineBulletRow}>
                              <View style={styles.bodyLineBulletDot} />
                              <View style={styles.bodyLineBulletContent}>
                                <ThemedText style={styles.bodyLineBullet} selectable={true}>
                                  {bulletHint?.main || item.text}
                                </ThemedText>
                                {bulletHint && (
                                  <View style={styles.bodyInlineHintBlock}>
                                    <View style={styles.bodyHintHeader}>
                                      <Ionicons
                                        name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                                        size={13}
                                        color="rgba(255,204,102,0.72)"
                                      />
                                      <ThemedText weight="semiBold" style={styles.bodyHintLabel} selectable={true}>
                                        {bulletHint.label}
                                      </ThemedText>
                                    </View>
                                    <View style={styles.bodyLineBulletHintRow}>
                                      {bulletHint.hints.map(hint => (
                                        <View key={hint} style={styles.bodyLineBulletHintChip}>
                                          <ThemedText style={styles.bodyLineBulletHintText} selectable={true}>
                                            {hint}
                                          </ThemedText>
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        }
                        if (item.type === 'check') {
                          const isYesNo = /^yes\s*\/\s*no$/i.test(item.text);
                          return (
                            <View key={idx} style={styles.bodyCheckRow}>
                              <ThemedText weight="semiBold" style={styles.bodyCheckLabel} selectable={true}>
                                {item.label}
                              </ThemedText>
                              {isYesNo ? (
                                <View style={styles.bodyCheckValuePill}>
                                  <ThemedText weight="semiBold" style={styles.bodyCheckValuePillText} selectable={true}>
                                    Yes / No
                                  </ThemedText>
                                </View>
                              ) : (
                                <ThemedText style={styles.bodyCheckValue} selectable={true}>
                                  {item.text}
                                </ThemedText>
                              )}
                            </View>
                          );
                        }
                        if (item.type === 'resourceList') {
                          return renderResourceListBlock(item, idx);
                        }
                        if (item.type === 'columns') {
                          return renderComparisonColumnsBlock(item, idx);
                        }
                        if (item.type === 'scriptureRead') {
                          return renderScriptureReadBlock(item, idx);
                        }
                        if (item.type === 'lineMeaning') {
                          return renderLineMeaningBlock(item, idx);
                        }
                        if (item.type === 'hint') {
                          const hintItems = splitHintDisplayItems(item.text);
                          const showHintChips = hintItems.length > 1 &&
                            hintItems.every(part => part.length <= 72) &&
                            !hintItems.some(part => /:\s*/.test(part));
                          return (
                            <View key={idx} style={styles.bodyHintRow}>
                              <View style={styles.bodyHintHeader}>
                                <Ionicons
                                  name={/limit/i.test(item.label || '') ? 'options-outline' : /daily|support/i.test(item.label || '') ? 'calendar-outline' : 'sparkles-outline'}
                                  size={13}
                                  color="rgba(255,204,102,0.72)"
                                />
                                <ThemedText weight="semiBold" style={styles.bodyHintLabel} selectable={true}>
                                  {displayHintLabel(item.label, hintItems.length)}
                                </ThemedText>
                              </View>
                              {showHintChips ? (
                                <View style={styles.bodyHintChipRow}>
                                  {hintItems.map(part => (
                                    <View key={part} style={styles.bodyHintChip}>
                                      <ThemedText style={styles.bodyHintChipText} selectable={true}>
                                        {part}
                                      </ThemedText>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <ThemedText style={styles.bodyHintText} selectable={true}>
                                  {item.text}
                                </ThemedText>
                              )}
                            </View>
                          );
                        }
                        if (item.type === 'field') {
                          return (
                            <View key={idx} style={styles.bodyFieldRow}>
                              <View style={styles.bodyFieldRail} />
                              <View style={styles.bodyFieldLabel}>
                                <ThemedText weight="semiBold" style={styles.bodyFieldLabelText} selectable={true}>
                                  {item.label}
                                </ThemedText>
                              </View>
                              <ThemedText style={styles.bodyFieldValue} selectable={true}>
                                {item.text}
                              </ThemedText>
                            </View>
                          );
                        }
                        if (item.type === 'quote') {
                          return (
                            <ThemedText key={idx} style={styles.bodyLineQuote} selectable={true}>
                              {item.text}
                            </ThemedText>
                          );
                        }
                        if (item.type === 'intro') {
                          return (
                            <ThemedText key={idx} style={styles.bodyLineIntro} selectable={true}>
                              {item.text}
                            </ThemedText>
                          );
                        }
                        return (
                          <ThemedText key={idx} style={styles.wisdomText} selectable={true}>
                            {item.text}
                          </ThemedText>
                        );
                        })();
                        return (
                          <Animated.View
                            key={`wisdom-line-${idx}-${item.type}-${item.label || ''}`}
                            style={{ opacity: lineOpacity, transform: [{ translateY: lineTranslateY }] }}
                          >
                            {content}
                          </Animated.View>
                        );
                      })}
                    </Animated.View>
                  </>
                ) : result.success === false ? (
                  <>
                    <ThemedText style={styles.errorTitle} selectable={true}>
                      Unable to Provide Wisdom
                    </ThemedText>
                    <ThemedText style={styles.errorMessage} selectable={true}>{result.message}</ThemedText>
                    <TouchableOpacity style={styles.retryButton} onPress={() => setResult(null)}>
                      <ThemedText weight="semiBold" style={styles.retryButtonText} selectable={true}>Try Again</ThemedText>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ) : (
              <>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="Type your question here..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    multiline
                    style={[styles.input, font]}
                    textAlignVertical="top"
                    autoFocus
                    keyboardAppearance="dark"
                  />
                  <View style={styles.charCounterWrapper}>
                    <ThemedText style={[styles.charCounterText, font]}>
                      {question.length}/500
                    </ThemedText>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (loading || question.trim().length < 5) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || question.trim().length < 5}
                >
                  {loading ? (
                    <View style={styles.loadingTextRow}>
                      <Animated.Text
                        numberOfLines={1}
                        style={[styles.submitButtonText, { opacity: loadingAnim, fontFamily: theme.fontFamily }]}
                      >
                        Thinking
                      </Animated.Text>
                      <Animated.Text
                        numberOfLines={1}
                        style={[styles.submitButtonText, styles.loadingDots, { opacity: loadingAnim, fontFamily: theme.fontFamily }]}
                      >
                        {'.'.repeat(dotIndex + 1)}
                      </Animated.Text>
                    </View>
                  ) : (
                    <ThemedText weight="semiBold" style={styles.submitButtonText}>Ask for Wisdom</ThemedText>
                  )}
                </TouchableOpacity>

                {wisdomLimit > 0 && (
                  <ThemedText style={styles.limitInfo}>
                    {wisdomCount}/{wisdomLimit} wisdom used this month
                  </ThemedText>
                )}
              </>
            )}
          </ScrollView>

          {/* FAB Buttons - Fixed at bottom */}
          {result && hasWisdom && (
            <View style={[styles.fabContainer, { bottom: insets.bottom + 16 }]}>
              {/* Journal expanded icons */}
              <Animated.View style={[styles.journalExpandedRow, { height: rowHeight, opacity: rowOpacity }]}>
                {JOURNAL_ICONS.map(({ type, icon, color, label }, idx) => (
                  <Animated.View
                    key={type}
                    style={{
                      opacity: iconAnims[idx],
                      transform: [{ scale: iconAnims[idx] }],
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      style={styles.journalIconButton}
                      onPress={() => {
                        triggerLightHaptic();
                        preserveDraftOnCloseRef.current = false;
                        setJournalExpanded(false);
                        onJournalPress?.({
                          question: resultQuestion || question.trim(),
                          wisdom: result?.wisdom?.trim() || '',
                          actionTitle,
                          type,
                        });
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.journalIconCircle, { backgroundColor: color + '28', borderColor: color + '20' }]}>
                        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                      </View>
                      <ThemedText style={[styles.journalIconLabel, { color }]}>{label}</ThemedText>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </Animated.View>

              <View style={styles.fabRow}>
                <View style={styles.fabLeftGroup}>
                  {onJournalPress ? (
                    <TouchableOpacity
                      style={styles.journalFabButton}
                      activeOpacity={0.8}
                      onPress={toggleJournalIcons}
                    >
                      <Animated.View style={{ transform: [{ rotate: triggerRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }, { scale: triggerScale }] }}>
                        <MaterialCommunityIcons name="pencil-plus-outline" size={20} color="rgba(255,255,255,0.55)" />
                      </Animated.View>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.fabRightGroup}>
                  <TouchableOpacity
                    onPress={() => {
                      triggerLightHaptic();
                      setResult(null);
                      setResultQuestion('');
                      setQuestion('');
                    }}
                  >
                    <Animated.View style={[styles.stillNeedHelpButton, { width: stillNeedHelpWidthAnim, gap: showStillNeedHelpLabel ? 8 : 0, paddingHorizontal: showStillNeedHelpLabel ? 16 : 0 }]}>
                      <Ionicons name="help-circle-outline" size={20} color={Colors.alertCoral} />
                      {showStillNeedHelpLabel && (
                        <ThemedText style={styles.stillNeedHelpLabel}>Still need help?</ThemedText>
                      )}
                    </Animated.View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => {
                      triggerLightHaptic();
                      preserveDraftOnCloseRef.current = false;
                      onDismiss();
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.hopeWhite} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 32,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 11,
    color: Colors.alertCoral,
    lineHeight: 14,
  },
  subtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    flex: 1,
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  actionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 8,
    fontWeight: '600',
  },
  prompt: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 32,
    padding: 16,
    paddingRight: 80,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  charCounterWrapper: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCounterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loadingTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  loadingDots: {
    width: 22,
    textAlign: 'left',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  limitInfo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  resultContainer: {
    padding: 20,
  },
  resultTitle: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 16,
    fontWeight: '600',
  },
  wisdomText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 24,
    marginBottom: 16,
  },
  wisdomOutput: {
    marginBottom: 24,
  },
  threadUserRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  threadAssistantRow: {
    alignItems: 'flex-start',
  },
  threadUserBubble: {
    maxWidth: '88%',
    backgroundColor: 'rgba(255,107,107,0.18)',
    borderRadius: 20,
    borderTopRightRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.28)',
  },
  threadAssistantBubble: {
    maxWidth: '94%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  threadAssistantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  threadLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.58)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  threadUserText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 22,
  },
  wisdomStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  wisdomStepCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  wisdomStepNumber: {
    fontSize: 12,
    color: Colors.alertCoral,
    lineHeight: 16,
  },
  wisdomStepTextWrapper: {
    flex: 1,
    paddingTop: 4,
  },
  wisdomStepTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 22,
    marginBottom: 2,
  },
  wisdomStepText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 24,
  },
  doneButton: {
    backgroundColor: Colors.growthGreen,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  doneButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  stillNeedHelpButton: {
    backgroundColor: '#3c436c',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stillNeedHelpButtonText: {
    color: Colors.alertCoral,
    fontSize: 16,
    fontWeight: '600',
  },
  stillNeedHelpLabel: {
    color: Colors.alertCoral,
    fontSize: 14,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fabLeftGroup: {
    minWidth: 64,
    alignItems: 'flex-start',
  },
  fabRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  journalFabButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2c4b78',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  journalFabCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalExpandedRow: {
    position: 'absolute',
    bottom: 54,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  journalIconButton: {
    alignItems: 'center',
    gap: 5,
  },
  journalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  journalIconLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  errorTitle: {
    fontSize: 20,
    color: Colors.alertCoral,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  retryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  // Body line styles — smart rendering (matching PlaybookWalkthroughScreen)
  bodyLineQuote: {
    fontSize: 16,
    color: Colors.faithGold,
    lineHeight: 24,
    fontStyle: 'italic',
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.faithGold,
  },
  bodyScriptBlock: {
    position: 'relative',
    marginTop: 12,
    marginBottom: 14,
    paddingLeft: 18,
    paddingVertical: 10,
    paddingRight: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,204,102,0.06)',
  },
  bodyScriptBlockPrayer: {
    marginBottom: 12,
  },
  bodyScriptRail: {
    position: 'absolute',
    left: 3,
    top: 12,
    bottom: 12,
    width: 4,
    alignItems: 'center',
  },
  bodyScriptRailCap: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.faithGold,
  },
  bodyScriptRailLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.faithGold,
  },
  bodyScriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  bodyScriptLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.faithGold,
    letterSpacing: 0.4,
  },
  bodyScriptText: {
    fontSize: 16,
    color: Colors.faithGold,
    lineHeight: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyAskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
  },
  bodyAskLabel: {
    fontSize: 12,
    color: 'rgba(255,204,102,0.78)',
    lineHeight: 15,
    letterSpacing: 0.25,
  },
  bodyQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    paddingLeft: 2,
  },
  bodyQuestionMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: Colors.faithGold,
    backgroundColor: 'rgba(255,204,102,0.12)',
  },
  bodyQuestionText: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 23,
  },
  bodyChecklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    marginBottom: 3,
  },
  bodyChecklistLabel: {
    fontSize: 12,
    color: 'rgba(255,204,102,0.78)',
    lineHeight: 15,
    letterSpacing: 0.25,
  },
  bodyChecklistItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 7,
    paddingVertical: 2,
  },
  bodyChecklistItemIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  bodyChecklistItemContent: {
    flex: 1,
    gap: 6,
  },
  bodyChecklistItemText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 23,
  },
  bodyLineIntro: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.90)',
    lineHeight: 25,
    letterSpacing: 0.1,
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  bodyLineBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    paddingLeft: 4,
  },
  bodyLineBulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,107,107,0.4)',
    marginTop: 8,
    marginRight: 10,
    flexShrink: 0,
  },
  bodyLineBullet: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 23,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyLineBulletContent: {
    flex: 1,
    gap: 6,
  },
  bodyInlineHintBlock: {
    gap: 5,
  },
  bodyLineBulletHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bodyLineBulletHintChip: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bodyLineBulletHintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.66)',
    lineHeight: 16,
  },
  bodyCheckRow: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    gap: 6,
  },
  bodyCheckLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.66)',
    lineHeight: 17,
  },
  bodyCheckValue: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 23,
  },
  bodyCheckValuePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,204,102,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,102,0.24)',
  },
  bodyCheckValuePillText: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
  },
  bodyHintRow: {
    marginTop: 2,
    marginBottom: 12,
    paddingLeft: 2,
    gap: 6,
  },
  bodyHintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bodyHintLabel: {
    fontSize: 11,
    color: 'rgba(255,204,102,0.72)',
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  bodyHintText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.64)',
    lineHeight: 21,
  },
  bodyHintChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  bodyHintChip: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  bodyHintChipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 17,
  },
  bodyResourceBlock: {
    marginTop: 8,
    marginBottom: 8,
    gap: 9,
  },
  bodyResourceIntro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.76)',
    lineHeight: 22,
  },
  bodyResourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bodyResourceLabel: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 15,
    letterSpacing: 0.25,
  },
  bodyResourceList: {
    gap: 8,
  },
  bodyResourceItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bodyResourceItemDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 8,
    backgroundColor: 'rgba(255,204,102,0.66)',
    flexShrink: 0,
  },
  bodyResourceItemText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  bodyColumnsBlock: {
    marginTop: 10,
    marginBottom: 12,
    gap: 12,
  },
  bodyColumnCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
    overflow: 'hidden',
  },
  bodyColumnHeader: {
    backgroundColor: 'rgba(255,204,102,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bodyColumnHeaderText: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
    letterSpacing: 0.25,
  },
  bodyColumnList: {
    paddingVertical: 6,
    gap: 2,
  },
  bodyColumnItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bodyColumnItemNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,204,102,0.12)',
    flexShrink: 0,
    marginTop: 1,
  },
  bodyColumnItemNumberText: {
    fontSize: 11,
    color: Colors.faithGold,
    lineHeight: 14,
  },
  bodyColumnItemText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 19,
  },
  bodyScriptureReadBlock: {
    marginTop: 8,
    marginBottom: 10,
    gap: 8,
  },
  bodyScriptureReadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bodyScriptureReadReference: {
    fontSize: 12,
    color: Colors.faithGold,
    lineHeight: 16,
    letterSpacing: 0.25,
  },
  bodyScriptureReadQuoteRow: {
    position: 'relative',
    paddingLeft: 12,
  },
  bodyScriptureReadRail: {
    position: 'absolute',
    left: 0,
    top: 3,
    bottom: 3,
    width: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,204,102,0.42)',
  },
  bodyScriptureReadText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 21,
  },
  bodyScriptureReadSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  bodyScriptureReadSummaryLabel: {
    fontSize: 11,
    color: Colors.faithGold,
    lineHeight: 17,
  },
  bodyScriptureReadSummaryText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },
  bodyLineMeaningBlock: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  bodyLineMeaningPhrase: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 21,
  },
  bodyLineMeaningSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  bodyFieldRow: {
    position: 'relative',
    marginTop: 4,
    paddingVertical: 5,
    paddingLeft: 10,
    gap: 4,
  },
  bodyFieldRail: {
    position: 'absolute',
    left: 0,
    top: 5,
    bottom: 5,
    width: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.42)',
  },
  bodyFieldLabel: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  bodyFieldLabelText: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.alertCoral,
    letterSpacing: 0.2,
  },
  bodyFieldValue: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 23,
    paddingTop: 0,
    paddingBottom: 0,
  },
});

export default HowToModal;
