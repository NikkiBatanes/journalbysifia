import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../components/common/ThemedText';
import { getPsalmReflection } from '../../data/psalmReflections';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';

const CarryItScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const psalmNumber = route.params?.psalmNumber ?? 1;
  const reflection = useMemo(() => getPsalmReflection(psalmNumber), [psalmNumber]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAttribute, setCustomAttribute] = useState('');
  useMorningStatusBar();

  const customValue = customAttribute.trim();
  const canContinue = selectedAttributes.length > 0 || (showCustomInput && customValue.length > 0);

  const toggleAttribute = (label: string) => {
    triggerLightHaptic();
    setSelectedAttributes((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
  };

  const onNext = React.useCallback(() => {
    if (!canContinue) { return; }
    triggerMediumHaptic();
    const observations = customValue ? [...selectedAttributes, customValue] : selectedAttributes;
    navigation.navigate('MorningClosing', {
      ...(route.params ?? {}),
      psalmNumber,
      selectedAttributes: observations,
      customAttribute: customValue || undefined,
      carry: observations.join(' · '),
    });
  }, [canContinue, customValue, navigation, psalmNumber, route.params, selectedAttributes]);

  // Horizontal swipe to advance / go back, same as the other morning steps
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          canContinue && gestureState.dx < -14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15,
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (isHorizontalSwipe && (hasEnoughDistance || hasEnoughVelocity) && gestureState.dx < 0) {
            onNext();
          }
        },
      }),
    [canContinue, onNext, screenWidth]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container} {...panResponder.panHandlers}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingTop: insets.top + 40,
            paddingBottom: Math.max(insets.bottom, 16) + 112,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.focusLabelContainer}>
            <Ionicons name="musical-notes-outline" size={16} color={Colors.sage} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.eyebrow}>PAUSE & PRAISE</ThemedText>
          </View>

          <ThemedText weight="semiBold" style={styles.title}>What do you see about God?</ThemedText>
          <ThemedText style={styles.subtitle}>Choose all that stand out to you in Psalm {psalmNumber}.</ThemedText>

          <View style={styles.pills}>
            {reflection.attributes.map((attribute) => {
              const isSelected = selectedAttributes.includes(attribute.label);
              return (
                <TouchableOpacity
                  key={attribute.label}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => toggleAttribute(attribute.label)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${attribute.label}, ${attribute.verses}`}
                >
                  <ThemedText style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {attribute.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.pill, showCustomInput && styles.pillSelected]}
              onPress={() => {
                triggerLightHaptic();
                setShowCustomInput((current) => !current);
                if (showCustomInput) { setCustomAttribute(''); }
              }}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: showCustomInput }}
              accessibilityLabel="Something else"
            >
              <ThemedText style={[styles.pillText, showCustomInput && styles.pillTextSelected]}>
                + Something else
              </ThemedText>
            </TouchableOpacity>
          </View>

          {showCustomInput && (
            <TextInput
              style={[styles.customInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
              multiline
              autoFocus
              placeholder="Another truth about God…"
              placeholderTextColor={Colors.textGray}
              value={customAttribute}
              onChangeText={setCustomAttribute}
              textAlignVertical="top"
              keyboardAppearance="light"
            />
          )}

          <View style={styles.metadataContainer}>
            <View style={styles.verticalLine} />
            <View style={styles.metadataContent}>
              <ThemedText weight="medium" style={styles.fromText}>CARRY IT WITH YOU</ThemedText>
              <ThemedText style={styles.metadataText}>
                Remember who God is as you step into today.
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        {canContinue && (
          <View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              onPress={onNext}
              activeOpacity={0.7}
              style={styles.primaryButtonTouch}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.lightBackground },
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  scroll: {
    flex: 1,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  labelIcon: {
    marginTop: 1,
  },
  eyebrow: {
    color: Colors.sageMuted,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  subtitle: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 48,
    paddingHorizontal: 24,
  },
  pill: {
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  pillSelected: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  pillText: {
    fontSize: 15,
    color: Colors.text,
  },
  pillTextSelected: {
    color: Colors.hopeWhite,
  },
  customInput: {
    minHeight: 96,
    marginTop: 28,
    marginHorizontal: 48,
    paddingVertical: 16,
    paddingHorizontal: 0,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
  },
  metadataContainer: {
    marginTop: 48,
    marginBottom: 24,
    marginHorizontal: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.text,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  metadataContent: {
    flex: 1,
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
  primaryButtonTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CarryItScreen;
