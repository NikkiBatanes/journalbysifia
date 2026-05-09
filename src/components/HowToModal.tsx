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
  wisdomCount: number;
  wisdomLimit: number;
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
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; wisdom?: string; error?: string; message?: string; wisdomCount?: number; wisdomLimit?: number; currentTier?: string; canUpgrade?: boolean } | null>(null);
  const preserveDraftOnCloseRef = React.useRef(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const resultAnim = React.useRef(new Animated.Value(0)).current;
  const loadingAnim = React.useRef(new Animated.Value(1)).current;
  const [dotIndex, setDotIndex] = useState(0);

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
    setSubmittedQuestion(currentQuestion);
    setResult(null);
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
  const wisdomItems = React.useMemo(() => {
    if (!result?.wisdom) {
      return { intro: '', items: [] as string[] };
    }

    const lines = result.wisdom
      .split(/\n+/)
      .map(line => line.replace(/\*\*/g, '').replace(/__([^_]+)__/g, '$1').trim())
      .filter(Boolean);

    const listStartIndex = lines.findIndex(line => /^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/.test(line));
    const hasList = listStartIndex !== -1;

    if (hasList) {
      const intro = lines.slice(0, listStartIndex).join('\n\n');
      const introLines = intro ? [intro] : [];
      const items: string[] = [];

      lines.slice(listStartIndex).forEach(line => {
        const item = line.replace(/^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/, '').trim();
        if (!item) {
          return;
        }
        if (/^(?:here\s+(?:are|is)|these\s+are|some\s+(?:examples|actionable\s+steps)|actionable\s+steps|examples)(?:\s+are|\s+is)?[\w\s,'-]*:?$/i.test(item)) {
          introLines.push(item);
          return;
        }
        if (items.length > 0 && isWisdomOutroLine(item)) {
          introLines.push(item);
          return;
        }
        if (items.length >= 3 && !splitWisdomItemTitle(item)) {
          introLines.push(item);
          return;
        }
        items.push(item);
      });

      return { intro: introLines.join('\n\n'), items };
    }

    return { intro: result.wisdom.replace(/\*\*/g, '').replace(/__([^_]+)__/g, '$1').trim(), items: [] as string[] };
  }, [result?.wisdom]);

  const resultTranslateY = resultAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

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

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}>
            <View style={styles.labelRow}>
              <Ionicons name="help-circle-outline" size={16} color={Colors.alertCoral} />
              <ThemedText weight="semiBold" style={styles.label}>HOW TO</ThemedText>
            </View>
            <View style={styles.titleRow}>
              <ThemedText weight="semiBold" style={styles.prompt}>
                {hasWisdom ? "Here's some wisdom" : 'What do you need help with for this action?'}
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
                      {wisdomItems.intro ? (
                        <ThemedText style={styles.wisdomText}>
                          {wisdomItems.intro}
                        </ThemedText>
                      ) : null}

                      {wisdomItems.items.map((item, index) => {
                        const titledItem = splitWisdomItemTitle(item);

                        return (
                          <View key={`${index}-${item}`} style={styles.wisdomStepRow}>
                            <View style={styles.wisdomStepTextWrapper}>
                              {titledItem ? (
                                <>
                                  <ThemedText weight="bold" style={styles.wisdomStepTitle}>
                                    {titledItem.title}
                                  </ThemedText>
                                  <ThemedText style={styles.wisdomStepText}>
                                    {titledItem.body}
                                  </ThemedText>
                                </>
                              ) : (
                                <ThemedText style={styles.wisdomStepText}>
                                  {item}
                                </ThemedText>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </Animated.View>
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => {
                        triggerLightHaptic();
                        preserveDraftOnCloseRef.current = false;
                        onDismiss();
                      }}
                    >
                      <ThemedText weight="semiBold" style={styles.doneButtonText}>Done</ThemedText>
                    </TouchableOpacity>
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
                        Asking
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
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  subtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  doneButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
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
});

export default HowToModal;
