import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
import RoutineStepShell from '../../components/routine/RoutineStepShell';

const UnderneathItScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { markStepCompleted } = useRoutine();
  const feeling = route.params?.feeling as string | undefined;
  const feelingIcon = route.params?.feelingIcon as string | undefined;
  const feelingIconType = route.params?.feelingIconType as 'ionicons' | 'material' | undefined;
  const [text, setText] = useState('');

  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const verticalLineHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 75,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [verticalLineHeight]);

  const onNext = React.useCallback(async () => {
    triggerMediumHaptic();
    await markStepCompleted('underneath');
    navigation.navigate('TodaysFocus', {
      feeling,
      feelingIcon,
      feelingIconType,
      underneath: text,
    });
  }, [feeling, feelingIcon, feelingIconType, markStepCompleted, navigation, text]);

  const footer = (
    <TouchableOpacity
      onPress={onNext}
      activeOpacity={0.7}
      style={styles.primaryButton}
    >
      <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
    </TouchableOpacity>
  );

  const onBack = () => navigation.goBack();

  const children = (
    <>
      <View style={styles.metadataContainer}>
        <Animated.View style={[styles.verticalLine, { height: verticalLineHeight }]} />
        <View style={styles.metadataContent}>
          {feelingIconType === 'material' && feelingIcon ? (
            <MaterialCommunityIcons
              name={feelingIcon as any}
              size={18}
              color={Colors.sage}
              style={styles.metadataIcon}
            />
          ) : (
            <Ionicons
              name={(feelingIcon || 'heart-outline') as any}
              size={18}
              color={Colors.sage}
              style={styles.metadataIcon}
            />
          )}
          <ThemedText weight="medium" style={styles.fromText}>
            FEELING
          </ThemedText>
          <ThemedText style={styles.metadataText}>
            {feeling ? (
              <>You named <ThemedText weight="semiBold">{feeling}</ThemedText></>
            ) : (
              'A gentle check-in for your heart'
            )}
          </ThemedText>
          <ThemedText style={styles.metadataText}>
            If there’s more on your heart, bring it before God here…
          </ThemedText>
        </View>
      </View>
    </>
  );

  return (
    <RoutineStepShell
      step={2}
      totalSteps={6}
      eyebrow="MORNING CHECK-IN"
      eyebrowIcon={<Ionicons name="sunny-outline" size={14} color={Colors.sage} />}
      title="What’s underneath that?"
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
    >
      <TextInput
        style={[styles.personalInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
        value={text}
        onChangeText={setText}
        placeholder="Take a moment to notice what’s on your heart."
        placeholderTextColor={Colors.textGray}
        multiline
        textAlignVertical="top"
        autoFocus
        keyboardAppearance="dark"
      />
      {children}
    </RoutineStepShell>
  );
};

const styles = StyleSheet.create({
  personalInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.text,
    backgroundColor: 'transparent',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 2,
    backgroundColor: Colors.sage,
    opacity: 0.4,
    marginRight: 12,
    borderRadius: 2,
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
    alignSelf: 'flex-end',
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
  },
});

export default UnderneathItScreen;
