import * as React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { triggerLightHaptic } from '../utils/haptics';
import { useTheme } from '../theme/ThemeContext';

type UserInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'> & {
  navigate: (screen: 'GeneratingPlaybook', params: { userInput: string; userName: string }) => void;
  reset: (state: any) => void; // Add reset method to navigation prop
};

const UserInputScreen: React.FC = () => {
  const navigation = useNavigation<UserInputScreenNavigationProp>();
  const inputRef = useRef<TextInput | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const font = React.useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);

  // Set status bar style
  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(Colors.anchorBlue);
    }
    StatusBar.setBarStyle('light-content');
    return () => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent');
      }
      StatusBar.setBarStyle('light-content');
    };
  }, []);

  // No scrolling needed; content is static and footer is fixed

  const [userInput, setUserInput] = useState('');
  // Typing, cycling placeholder for guided, non-chat input
  const [placeholderText, setPlaceholderText] = useState('What happened?');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const prompts = [
      'What happened?',
      'How is it affecting you?',
      'What are you struggling with?',
      'What decision is ahead?',
    ];

    let isMounted = true;
    let promptIndex = 0;
    let charIndex = prompts[0].length; // start at full first prompt so placeholder is visible initially

    const clearTimer = () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    };

    const typeNext = () => {
      if (!isMounted) {return;}
      const current = prompts[promptIndex];
      if (charIndex <= current.length) {
        setPlaceholderText(current.slice(0, charIndex));
        charIndex += 1;
        typingTimer.current = setTimeout(typeNext, 60);
      } else {
        // Pause, then erase and move to next prompt
        typingTimer.current = setTimeout(() => {
          const erase = () => {
            if (!isMounted) {return;}
            if (charIndex >= 0) {
              setPlaceholderText(current.slice(0, charIndex));
              charIndex -= 1;
              typingTimer.current = setTimeout(erase, 35);
            } else {
              promptIndex = (promptIndex + 1) % prompts.length;
              charIndex = 0;
              typeNext();
            }
          };
          erase();
        }, 1600);
      }
    };

    typeNext();

    return () => {
      isMounted = false;
      clearTimer();
    };
  }, []);

  const { user } = useAuth();
  // const userId = user?.id; // Unused, commented out
  const userName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBorderWidth = useRef(new Animated.Value(1)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(6)).current;
  const headerTranslateY = useRef(new Animated.Value(-16)).current; // start slightly above for intro
  const headerScale = useRef(new Animated.Value(1)).current;
  const headerIntroOpacity = useRef(new Animated.Value(0)).current;
  const askBoxTranslateY = useRef(new Animated.Value(16)).current;
  const askBoxOpacity = useRef(new Animated.Value(0)).current;

  // Simple chat input - no complex height calculations needed

  // Intro animation when screen first opens
  useEffect(() => {
    Animated.sequence([
      Animated.delay(220), // small delay to let modal finish sliding
      Animated.parallel([
        Animated.timing(headerIntroOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(headerTranslateY, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(askBoxOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.timing(askBoxTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
          ]),
        ]),
      ]),
    ]).start();
  }, []);
  const handleFocus = () => {
    Animated.timing(inputBorderWidth, {
      toValue: 2,
      duration: 120,
      useNativeDriver: false,
    }).start();
    // Move logo down closer to the input with a gentle spring and slight scale
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: 96,
        useNativeDriver: true,
        stiffness: 180,
        damping: 18,
        mass: 0.9,
      }),
      Animated.timing(headerScale, {
        toValue: 0.98,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    if (showTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
      ]).start(() => setShowTooltip(false));
    }
  };
  const handleBlur = () => {
    Animated.timing(inputBorderWidth, {
      toValue: 1,
      duration: 120,
      useNativeDriver: false,
    }).start();
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 200,
        damping: 20,
        mass: 0.9,
      }),
      Animated.timing(headerScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButton = () => {
    // Simple button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Use the real generatePlaybook from the API service
  // Remove the local mock implementation.

  const handleGeneratePlaybook = async () => {
    try { triggerLightHaptic(); } catch {}
    animateButton();
    if (!userInput.trim()) {
      // Show error animation
      Animated.sequence([
        Animated.timing(inputBorderWidth, {
          toValue: 2,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(inputBorderWidth, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
      Alert.alert('Input Required', 'Please share what you\'re struggling with.');
      return;
    }

    // Navigate directly to GeneratingPlaybookScreen - it will handle the generation
    navigation.navigate('GeneratingPlaybook', {
      userInput,
      userName: userName || 'Friend',
    });
};

  const handleInputPress = () => {
    inputRef.current?.focus();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    if (showTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
      ]).start(() => setShowTooltip(false));
    }
  };

  const [showTooltip, setShowTooltip] = useState(false);
  const onPressHint = () => {
    try { triggerLightHaptic(); } catch {}
    setShowTooltip((v) => {
      const next = !v;
      if (next) {
        Animated.parallel([
          Animated.timing(tooltipOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(tooltipTranslateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
        ]).start();
      }
      return next;
    });
  };

  // Rely on KeyboardAvoidingView for precise avoidance; no manual listeners

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: insets.bottom || 0, android: 0 })}
        style={styles.container}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.content}>
          <Animated.View style={[styles.header, { transform: [{ translateY: headerTranslateY }, { scale: headerScale }] }]}>
            <Animated.Image source={require('../../assets/images/siFia.png')} style={[styles.logo, { opacity: headerIntroOpacity }]} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* Fixed footer input anchored to safe area */}
        <View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 8 }]}>
          <View style={styles.inputContainer}>
            <Animated.View style={[{ opacity: askBoxOpacity, transform: [{ translateY: askBoxTranslateY }] }]}>
              <View style={styles.askWrapper}>
                <Animated.View style={[styles.askBox, { borderWidth: inputBorderWidth }]}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.askInput, font]}
                    placeholder={placeholderText}
                    placeholderTextColor={'rgba(255,255,255,0.7)'}
                    value={userInput}
                    onChangeText={setUserInput}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={true}
                    autoCapitalize="sentences"
                    keyboardAppearance="dark"
                    underlineColorAndroid="transparent"
                    autoCorrect={true}
                    autoFocus={false}
                    onTouchStart={handleInputPress}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    blurOnSubmit={false}
                  />
                  <View style={styles.actionsOverlay}>
                    <TouchableOpacity
                      onPress={onPressHint}
                      activeOpacity={0.9}
                      style={[styles.askHintButton, !showTooltip && styles.disabledButton]}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <MaterialCommunityIcons
                        name="information"
                        size={34}
                        color={showTooltip ? Colors.alertCoral : 'rgba(255, 255, 255, 0.5)'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.askSendButton, (!userInput || !userInput.trim()) && styles.disabledButton]}
                      onPress={handleGeneratePlaybook}
                      disabled={!userInput || !userInput.trim()}
                    >
                      <Ionicons
                        name="arrow-up-circle"
                        size={34}
                        color={userInput.trim() ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.5)'}
                      />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
                {/* Tooltip anchored above hint icon; placed outside askBox to avoid clipping */}
                {showTooltip && (
                  <Animated.View style={[styles.tooltip, { opacity: tooltipOpacity, transform: [{ translateY: tooltipTranslateY }] }]} pointerEvents="box-none">
                    <Text style={[styles.tooltipKicker, font]}>How Fia can help you.</Text>
                    <Text style={[styles.tooltipTitle, font]}>Share what you're going through in detail. The more context, the better.</Text>
                    <Text style={[styles.tooltipSubtitle, font]}>Helpful details to include:</Text>
                    <View style={styles.tooltipList}>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>1</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>What happened</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>2</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>Your pain</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>3</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>A situation or struggle</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>4</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>A decision you need to make</Text>
                      </View>
                    </View>
                    <Text style={[styles.tooltipFooter, font]}>Then we'll turn this into a personalized playbook.</Text>
                    <View style={styles.tooltipCaret} />
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingBottom: 0,
  },
  askHintButtonInline: {
    opacity: 1,
  },
  askSendButtonInline: {
    opacity: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  logo: {
    width: '80%',
    height: 150,
  },
  guidanceSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
  },
  spacer: {
    flex: 0,
  },
  footer: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  inputContainer: {
    paddingBottom: 24,
    marginBottom: Platform.OS === 'ios' ? 0 : 20, // Add some bottom margin on Android
  },
  askWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  askBox: {
    borderRadius: 32,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 0, // Remove padding to allow seamless scrolling
    paddingBottom: 60, // Space for overlay icons
    width: '100%',
    minHeight: 60,
    position: 'relative',
    overflow: 'hidden', // Clip content at container edges
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8 as any,
  },
  askInput: {
    width: '100%',
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    padding: 16,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    minHeight: 120,
    maxHeight: 120,
    ...Platform.select({
      ios: {
        paddingTop: 16,
      },
      android: {
        textAlignVertical: 'top',
        paddingTop: 16,
      },
    }),
  },
  askSendButton: {
    // positioned in bottomRow
  },
  askHintButton: {
    // positioned in bottomRow  
  },
  tooltip: {
    position: 'absolute',
    right: 48, // align above hint icon more closely
    bottom: 62, // above icons
    maxWidth: 280,
    backgroundColor: Colors.alertCoral,
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    zIndex: 20,
  },
  tooltipTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  tooltipKicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  tooltipSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  tooltipList: {
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  tooltipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tooltipBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tooltipBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipItemText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
  },
  tooltipFooter: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  tooltipCaret: {
    position: 'absolute',
    right: 24, // tuned to point towards the hint icon
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: Colors.alertCoral,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  tooltipClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
    borderRadius: 20,
    padding: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Slight background for better visibility
  },
});

export default UserInputScreen;
