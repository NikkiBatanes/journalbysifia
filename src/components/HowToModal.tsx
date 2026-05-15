import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
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
  wisdomCount: number;
  wisdomLimit: number;
}

type BodyLineType = 'intro' | 'quote' | 'script' | 'choice' | 'bullet' | 'checklistItem' | 'field' | 'check' | 'hint' | 'ask' | 'question' | 'checklist' | 'body';

interface BodyLine {
  text: string;
  type: BodyLineType;
  label?: string;
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
    ['"', '"'],
    ['', ''],
  ];

  let changed = true;
  while (changed && out.length >= 2) {
    changed = false;
    for (const [open, close] of quotePairs) {
      if (out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(open.length, out.length - close.length).trim();
        changed = true;
        break;
      }
    }
  }

  return out;
}

function isQuotedActionLine(line: string): boolean {
  return /^["\u201C\u201D]/.test(line.trim());
}

function isScriptIntroLine(line: string): boolean {
  const trimmed = line.trim();
  return /^(?:(?:say|send|text|message|write|ask|pray)\b|.*\b(?:with this message|say aloud|pause and say aloud|say plainly|say this(?: clearly| plainly)?)\b)[^:]{0,80}:\s*$/i.test(trimmed)
    && /\b(?:this|message|text|script|plainly|aloud|words?|reply|sentence|prayer|ask)\b/i.test(trimmed);
}

function scriptLabelForIntro(line: string): string {
  if (/\bsay\s+plainly\b/i.test(line)) {
    return 'Say plainly';
  }
  if (/\beach\s+morning\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Each morning say aloud';
  }
  if (/\beach\s+(?:day|night|evening)\b/i.test(line) && /\bsay\s+aloud\b/i.test(line)) {
    return 'Say aloud daily';
  }
  if (/\b(?:message|text|send|reply)\b/i.test(line)) {
    return 'Message to send';
  }
  if (/\b(?:pray|prayer)\b/i.test(line)) {
    return 'Prayer to say';
  }
  return 'Words to say';
}

function isChecklistIntroLine(line: string): boolean {
  return /^(?:do this|steps to take|action steps):\s*$/i.test(line.trim());
}

function isAskPromptIntroLine(line: string): boolean {
  return /^(?:(?:read|rad) slow(?:ly|ely) and ask|pause and ask|ask|then ask|ask yourself|test|check):\s*$/i.test(line.trim());
}

function askPromptLabel(line: string): string {
  const trimmed = line.trim();
  if (/^(?:read|rad) slow(?:ly|ely) and ask/i.test(trimmed)) {
    return 'Read slowly and ask';
  }
  if (/^pause and ask/i.test(trimmed)) {
    return 'Pause and ask';
  }
  if (/^test/i.test(trimmed)) {
    return 'Test this';
  }
  if (/^check/i.test(trimmed)) {
    return 'Check this';
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

function parentheticalHintLabelForMain(main: string): string {
  return /\b(?:limit|limits|boundary|boundaries|off-limits|allowed|forbidden|rules?)\b/i.test(main)
    ? 'Possible limits'
    : 'Suggestions';
}

function splitListHintItems(value: string): string[] {
  return String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+plus\s+(?=(?:check-ins?|accountability|prayer|healthy|rest|meals|Bible|waking)\b)/gi, ', ')
    .replace(/\s+and\s+(?=(?:avoiding|avoid|no|prayer|healthy|rest|attending|meeting|meals|places|people)\b)/gi, ', ')
    .split(/\s*,\s*/)
    .map(part => part.trim().replace(/[.!?]+$/g, ''))
    .filter(Boolean);
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
    label: parentheticalHintLabelForMain(main),
  };
}

function splitQuestionPromptText(value: string): string[] {
  const questions = String(value || '')
    .split(/(?<=\?)\s+(?=\S)/)
    .map(part => part.trim())
    .filter(Boolean);
  return questions.length > 0 ? questions : [String(value || '').trim()].filter(Boolean);
}

function splitLeadingQuotedActionText(value: string): { quote: string; rest: string } {
  const source = String(value || '').trim();
  const open = source[0];
  if (open !== '"' && open !== '"' && open !== "'" && open !== '') {
    return { quote: source, rest: '' };
  }

  const close = open === '"' ? '"' : open === '' ? '' : open;
  for (let i = 1; i < source.length; i++) {
    if (source[i] === close && source[i - 1] !== '\\' && !isActionApostrophe(source, i)) {
      const rawQuote = source.slice(0, i + 1).trim();
      const quote = open === "'" || open === ''
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

function splitReadableActionLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) { return []; }
  if (/^(?:\*|-|•) /.test(trimmed)) { return [trimmed.replace(/^(?:-|•) /, '* ')]; }
  const embeddedScript = trimmed.match(/^(.+?[.!?])\s+(.{0,120}?\b(?:reach out(?: today)? with this message|with this message|pause and say aloud|say aloud|say plainly|say this(?: clearly| plainly)?|send(?: this)? message|message|text|write|ask|pray)\b[^:]{0,60}:\s*)(["'\u201C\u2018].+)$/i);
  if (embeddedScript) {
    const { quote, rest } = splitLeadingQuotedActionText(embeddedScript[3]);
    return [
      embeddedScript[1].trim(),
      embeddedScript[2].trim(),
      quote,
      ...splitReadableActionLine(rest),
    ];
  }
  const inlineScript = trimmed.match(/^(.{0,150}?\b(?:reach out(?: today)? with this message|with this message|pause and say aloud|say aloud|say plainly|say this(?: clearly| plainly)?|send(?: this)? message|message|text|write|ask|pray)\b[^:]{0,60}:\s*)(["'\u201C\u2018].+)$/i);
  if (inlineScript) {
    const { quote, rest } = splitLeadingQuotedActionText(inlineScript[2]);
    return [inlineScript[1].trim(), quote, ...splitReadableActionLine(rest)];
  }
  const embeddedQuestionPrompt = trimmed.match(/^(.+?[.!?])\s+((?:(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|ask(?:\s+yourself)?|test|check)\s*:\s*)(.+)$/i);
  if (embeddedQuestionPrompt) {
    return [
      embeddedQuestionPrompt[1].trim(),
      capitalizeFirstLetter(embeddedQuestionPrompt[2].trim()),
      ...splitQuestionPromptText(embeddedQuestionPrompt[3]),
    ];
  }
  const embeddedLooseQuestionPrompt = trimmed.match(/^(.+?)\s+((?:(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|ask(?:\s+yourself)?|test|check)\s*:\s*)(.+)$/i);
  if (embeddedLooseQuestionPrompt && embeddedLooseQuestionPrompt[1].trim().length > 8) {
    return [
      ...splitReadableActionLine(embeddedLooseQuestionPrompt[1].trim()),
      capitalizeFirstLetter(embeddedLooseQuestionPrompt[2].trim()),
      ...splitQuestionPromptText(embeddedLooseQuestionPrompt[3]),
    ];
  }
  const questionPrompt = trimmed.match(/^((?:(?:read|rad)\s+slow(?:ly|ely)\s+and\s+ask|pause\s+and\s+ask|then\s+ask|ask(?:\s+yourself)?|test|check)\s*:\s*)(.+)$/i);
  if (questionPrompt) {
    return [
      capitalizeFirstLetter(questionPrompt[1].trim()),
      ...splitQuestionPromptText(questionPrompt[2]),
    ];
  }
  if (/^["\u201C]/.test(trimmed)) { return [trimmed]; }

  const sentenceParts = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map(part => part.trim())
    .filter(Boolean);
  if (
    sentenceParts.length >= 2 &&
    sentenceParts.some(part => /\([^)]+\)/.test(part) || /^Then\b/i.test(part))
  ) {
    return sentenceParts.flatMap(part => splitReadableActionLine(part));
  }

  const parentheticalHint = extractParentheticalActionHint(trimmed);
  if (parentheticalHint) {
    return [parentheticalHint.main, `${parentheticalHint.label}: ${parentheticalHint.hints.join('; ')}`];
  }

  if (trimmed.length < 145) { return [trimmed]; }

  return sentenceParts.length >= 2 ? sentenceParts : [trimmed];
}

function normalizeActionMarkup(text: string): string {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<p\s*>/gi, '')
    .replace(/<\/?.[^>]+>/g, '');
}

function cleanWisdomDisplayText(value: string): string {
  if (!value) return '';
  return value
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .trim();
}

function detectBodyLines(lines: string[]): BodyLine[] {
  const out: BodyLine[] = [];
  let expectingPromptQuestion = false;
  let inChecklist = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    const nextLine = lines[idx + 1]?.trim() || '';

    if (isScriptIntroLine(line) && isQuotedActionLine(nextLine)) {
      out.push({
        label: scriptLabelForIntro(line),
        text: stripBalancedActionQuotes(nextLine),
        type: 'script',
      });
      idx++;
      inChecklist = false;
      continue;
    }

    if (/^(?:\*|-|•) /.test(line)) {
      out.push({
        text: line.replace(/^(?:\*|-|•) /, '').trim(),
        type: inChecklist ? 'checklistItem' : 'bullet',
      });
      expectingPromptQuestion = false;
      continue;
    }

    if (isAskPromptIntroLine(line)) {
      out.push({ label: askPromptLabel(line), text: '', type: 'ask' });
      expectingPromptQuestion = true;
      inChecklist = false;
      continue;
    }

    if (expectingPromptQuestion && line.endsWith('?')) {
      out.push({ text: line, type: 'question' });
      inChecklist = false;
      continue;
    }

    if (isChecklistIntroLine(line)) {
      out.push({ label: 'Do this', text: '', type: 'checklist' });
      expectingPromptQuestion = false;
      inChecklist = true;
      continue;
    }

    if (line.endsWith(':') && line.length < 90) {
      out.push({ text: line, type: 'intro' });
      expectingPromptQuestion = false;
      inChecklist = false;
      continue;
    }

    if (isQuotedActionLine(line)) {
      out.push({ text: line, type: 'quote' });
      expectingPromptQuestion = false;
      inChecklist = false;
      continue;
    }

    const hintMatch = line.match(/^(Suggestions|Examples|Possible limits|Limit examples|Daily supports):\s*(.+)$/i);
    if (hintMatch) {
      out.push({ label: capitalizeFirstLetter(hintMatch[1].trim()), text: hintMatch[2].trim(), type: 'hint' });
      expectingPromptQuestion = false;
      inChecklist = false;
      continue;
    }

    const fieldMatch = line.match(/^(Trigger|Lie|Temptation|Replacement response|Replacement|Practice|Stop|Start):\s*(.+)$/i);
    if (fieldMatch) {
      const label = fieldMatch[1]
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/^Replacement(?: Response)?$/i, 'Response');
      out.push({ label, text: fieldMatch[2].trim(), type: 'field' });
      expectingPromptQuestion = false;
      inChecklist = false;
      continue;
    }

    const checkInLine = isCheckInLabelValueLine(line);
    if (checkInLine) {
      out.push({ label: checkInLine.label, text: checkInLine.text, type: 'check' });
      expectingPromptQuestion = false;
      inChecklist = false;
      continue;
    }

    out.push({ text: line, type: 'body' });
    expectingPromptQuestion = false;
    inChecklist = false;
  }

  return out;
}

function splitWisdomItemTitle(value: string): { title: string; body: string } | null {
  const match = value.match(/^([^:]{3,64}):\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    title: match[1].trim(),
    body: match[2].trim(),
  };
}

function isWisdomOutroLine(value: string): boolean {
  return /^(?:remember|as you|this simple|these steps|by doing|through this|over time|with each|even small|start small|you can|may this|let this|trust that)\b/i.test(value.trim());
}

const HowToModal: React.FC<HowToModalProps> = ({
  visible,
  actionTitle,
  actionNumber,
  onDismiss,
  onSubmit,
  onThreadUpdate,
  wisdomCount,
  wisdomLimit,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const theme = useTheme();
  const font = React.useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  const [question, setQuestion] = useState('');
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

  const navigateToSalesOffer = React.useCallback((count = wisdomCount, limit = wisdomLimit, currentTier?: string) => {
    preserveDraftOnCloseRef.current = true;
    onDismiss();
    (navigation as any).navigate('OnboardingSalesOffer', {
      upgradeMode: true,
      source: 'wisdom_limit',
      feature: 'wisdom',
      featureType: 'wisdom',
      currentTier,
      tier: currentTier,
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
        setResult(null);
      }
      setLoading(false);
    }
  }, [visible, fadeAnim, resultAnim]);

  React.useEffect(() => {
    if (result?.success && result.wisdom) {
      resultAnim.setValue(0);
      Animated.spring(resultAnim, {
        toValue: 1,
        tension: 42,
        friction: 8,
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
    // Force a re-render to ensure loading state is visible
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const response = await onSubmit(currentQuestion);
      if (response.error === 'WISDOM_LIMIT_REACHED') {
        if (response.canUpgrade === false) {
          setResult(response);
        } else {
          navigateToSalesOffer(response.wisdomCount ?? wisdomCount, response.wisdomLimit ?? wisdomLimit, response.currentTier);
        }
        return;
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

    const lines = result.wisdom
      .split(/\n+/)
      .flatMap(line => splitReadableActionLine(line))
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

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
            <View style={styles.labelRow}>
              <Ionicons name="help-circle-outline" size={16} color={Colors.alertCoral} />
              <ThemedText weight="semiBold" style={styles.label}>HOW TO</ThemedText>
            </View>
            <View style={styles.titleRow}>
              <ThemedText weight="semiBold" style={styles.prompt}>
                {hasWisdom ? "Here's some wisdom" : 'What do you need help\nwith for this action?'}
              </ThemedText>
            </View>
            <View style={styles.subtextRow}>
              {actionNumber !== undefined && (
                <View style={styles.stepCircle}>
                  <ThemedText weight="bold" style={styles.stepNumber}>{actionNumber}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.subtext}>{actionTitle}</ThemedText>
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
                        if (item.type === 'script') {
                          return (
                            <View key={idx} style={styles.bodyScriptBlock}>
                              <View style={styles.bodyScriptRail} />
                              <View style={styles.bodyScriptHeader}>
                                <Ionicons name="volume-medium-outline" size={13} color={Colors.faithGold} />
                                <ThemedText weight="semiBold" style={styles.bodyScriptLabel}>
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
                              <ThemedText weight="semiBold" style={styles.bodyAskLabel}>
                                {item.label || 'Ask yourself'}
                              </ThemedText>
                            </View>
                          );
                        }
                        if (item.type === 'question') {
                          return (
                            <View key={idx} style={styles.bodyQuestionRow}>
                              <ThemedText style={styles.bodyQuestionMark}>?</ThemedText>
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
                              <ThemedText weight="semiBold" style={styles.bodyChecklistLabel}>
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
                                      <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                                        {bulletHint.label}
                                      </ThemedText>
                                    </View>
                                    <View style={styles.bodyLineBulletHintRow}>
                                      {bulletHint.hints.map(hint => (
                                        <View key={hint} style={styles.bodyLineBulletHintChip}>
                                          <ThemedText style={styles.bodyLineBulletHintText}>
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
                                {Platform.OS === 'ios' && !bulletHint ? (
                                  <TextInput
                                    value={item.text}
                                    editable={false}
                                    multiline={true}
                                    scrollEnabled={false}
                                    style={[styles.bodyLineBullet, { fontFamily: theme.fontFamily }]}
                                  />
                                ) : (
                                  <ThemedText style={styles.bodyLineBullet} selectable={true}>
                                    {bulletHint?.main || item.text}
                                  </ThemedText>
                                )}
                                {bulletHint && (
                                  <View style={styles.bodyInlineHintBlock}>
                                    <View style={styles.bodyHintHeader}>
                                      <Ionicons
                                        name={/limit/i.test(bulletHint.label) ? 'options-outline' : 'sparkles-outline'}
                                        size={13}
                                        color="rgba(255,204,102,0.72)"
                                      />
                                      <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                                        {bulletHint.label}
                                      </ThemedText>
                                    </View>
                                    <View style={styles.bodyLineBulletHintRow}>
                                      {bulletHint.hints.map(hint => (
                                        <View key={hint} style={styles.bodyLineBulletHintChip}>
                                          <ThemedText style={styles.bodyLineBulletHintText}>
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
                              <ThemedText weight="semiBold" style={styles.bodyCheckLabel}>
                                {item.label}
                              </ThemedText>
                              {isYesNo ? (
                                <View style={styles.bodyCheckValuePill}>
                                  <ThemedText weight="semiBold" style={styles.bodyCheckValuePillText}>
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
                        if (item.type === 'hint') {
                          const hintItems = item.text
                            .split(/\s*(?:;|,)\s*/)
                            .map(part => part.trim())
                            .filter(Boolean);
                          const showHintChips = hintItems.length > 1 && hintItems.every(part => part.length <= 72);
                          return (
                            <View key={idx} style={styles.bodyHintRow}>
                              <View style={styles.bodyHintHeader}>
                                <Ionicons
                                  name={/limit/i.test(item.label || '') ? 'options-outline' : /daily|support/i.test(item.label || '') ? 'calendar-outline' : 'sparkles-outline'}
                                  size={13}
                                  color="rgba(255,204,102,0.72)"
                                />
                                <ThemedText weight="semiBold" style={styles.bodyHintLabel}>
                                  {/examples/i.test(item.label || '') ? 'Suggestions' : item.label || 'Suggestions'}
                                </ThemedText>
                              </View>
                              {showHintChips ? (
                                <View style={styles.bodyHintChipRow}>
                                  {hintItems.map(part => (
                                    <View key={part} style={styles.bodyHintChip}>
                                      <ThemedText style={styles.bodyHintChipText}>
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
                                <ThemedText weight="semiBold" style={styles.bodyFieldLabelText}>
                                  {item.label}
                                </ThemedText>
                              </View>
                              {Platform.OS === 'ios' ? (
                                <TextInput
                                  value={item.text}
                                  editable={false}
                                  multiline={true}
                                  scrollEnabled={false}
                                  style={[styles.bodyFieldValue, { fontFamily: theme.fontFamily }]}
                                />
                              ) : (
                                <ThemedText style={styles.bodyFieldValue} selectable={true}>
                                  {item.text}
                                </ThemedText>
                              )}
                            </View>
                          );
                        }
                        if (item.type === 'quote') {
                          return Platform.OS === 'ios' ? (
                            <TextInput
                              key={idx}
                              value={item.text}
                              editable={false}
                              multiline={true}
                              scrollEnabled={false}
                              style={[styles.bodyLineQuote, { fontFamily: theme.fontFamily }]}
                            />
                          ) : (
                            <ThemedText key={idx} style={styles.bodyLineQuote} selectable={true}>
                              {item.text}
                            </ThemedText>
                          );
                        }
                        if (item.type === 'intro') {
                          return Platform.OS === 'ios' ? (
                            <TextInput
                              key={idx}
                              value={item.text}
                              editable={false}
                              multiline={true}
                              scrollEnabled={false}
                              style={[styles.bodyLineIntro, { fontFamily: theme.fontFamily }]}
                            />
                          ) : (
                            <ThemedText key={idx} style={styles.bodyLineIntro} selectable={true}>
                              {item.text}
                            </ThemedText>
                          );
                        }
                        return Platform.OS === 'ios' ? (
                          <TextInput
                            key={idx}
                            value={item.text}
                            editable={false}
                            multiline={true}
                            scrollEnabled={false}
                            style={[styles.wisdomText, { fontFamily: theme.fontFamily }]}
                          />
                        ) : (
                          <ThemedText key={idx} style={styles.wisdomText} selectable={true}>
                            {item.text}
                          </ThemedText>
                        );
                      })}
                    </Animated.View>
                  </>
                ) : result.success === false ? (
                  <>
                    <ThemedText style={styles.errorTitle}>
                      Unable to Provide Wisdom
                    </ThemedText>
                    <ThemedText style={styles.errorMessage}>{result.message}</ThemedText>
                    <TouchableOpacity style={styles.retryButton} onPress={() => setResult(null)}>
                      <ThemedText weight="semiBold" style={styles.retryButtonText}>Try Again</ThemedText>
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
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setResult(null);
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
    backgroundColor: Colors.anchorBlue,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    right: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    zIndex: 100,
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
    marginTop: 6,
    marginBottom: 6,
    paddingLeft: 16,
    paddingVertical: 10,
    paddingRight: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,204,102,0.06)',
  },
  bodyScriptRail: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 999,
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
    backgroundColor: 'rgba(255,204,102,0.12)',
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
    marginBottom: 6,
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
