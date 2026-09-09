import React, { useMemo, useState } from 'react';
import { Animated, KeyboardAvoidingView, PanResponder, Platform, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic } from '../../utils/haptics';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';

const CarryItScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const [text, setText] = useState('');
  useMorningStatusBar();

  const onNext = React.useCallback(() => {
    triggerLightHaptic();
    navigation.navigate('MorningClosing', {
      ...(route.params ?? {}),
      carry: text,
    });
  }, [navigation, route.params, text]);

  // Horizontal swipe to advance / go back, same as the other morning steps
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return gestureState.dx < -14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx < 0) {
            onNext();
          }
        },
      }),
    [onNext, screenWidth]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]} {...panResponder.panHandlers}>
        <View style={styles.focusLabelContainer}>
          <Ionicons name="bag-outline" size={16} color={Colors.sage} style={styles.labelIcon} />
          <ThemedText weight="semiBold" style={styles.eyebrow}>CARRY WITH YOU</ThemedText>
        </View>
        <ThemedText style={styles.title}>What do you want to carry with you today?</ThemedText>

        <TextInput
          style={[styles.input, { fontFamily: getFontFamily(fontKey, 'regular') }]}
          multiline
          placeholder="What will you carry with you today?"
          placeholderTextColor={Colors.textGray}
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />

        <View style={styles.metadataContainer}>
          <View style={styles.verticalLine} />
          <View style={styles.metadataContent}>
            <Ionicons name="bookmark-outline" size={18} color={Colors.sage} style={styles.metadataIcon} />
            <ThemedText weight="medium" style={styles.fromText}>CARRY</ThemedText>
            <ThemedText style={styles.metadataText}>
              A word, a truth, or a posture to hold onto as the day unfolds.
            </ThemedText>
          </View>
        </View>

        <Animated.View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.lightBackground },
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 18,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  labelIcon: {
    marginTop: 1,
  },
  eyebrow: {
    color: Colors.sageMuted,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 30,
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 16,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.text,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
    height: 75,
  },
  metadataContent: {
    flex: 1,
  },
  metadataIcon: {
    marginBottom: 4,
    opacity: 0.8,
  },
  fromText: {
    fontSize: 8,
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 16,
  },
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
});

export default CarryItScreen;
