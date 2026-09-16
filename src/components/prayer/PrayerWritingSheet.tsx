import { triggerLightHaptic } from '../../utils/haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { useFloatingKeyboardButton } from '../../hooks/useFloatingKeyboardButton';

type Props = { keepAfterInputVisible?: boolean; beforeInput?: React.ReactNode; afterInput?: React.ReactNode; maxLength?: number; saveEnabled?: boolean; title: string; eyebrow: string; context: string; contextLabel: string; placeholder: string; value: string; onChangeText: (text: string) => void; onClose: () => void; onSave: () => void; onDelete?: () => void; saving: boolean; ready?: boolean; editable?: boolean; saveLabel: string; onShowDetails?: () => void };
export default function PrayerWritingSheet({ title, eyebrow, context, contextLabel, placeholder, value, onChangeText, onClose, onSave, onDelete, saving, ready = true, editable = true, saveLabel, onShowDetails, beforeInput, afterInput, maxLength, saveEnabled = true, keepAfterInputVisible = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const sheetEntrance = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const requestCollapse = useRef(Animated.diffClamp(scrollY, 0, 72)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [requestHeight, setRequestHeight] = useState(80);
  const [writingHeight, setWritingHeight] = useState(280);
  const [inputHeight, setInputHeight] = useState(180);
  useEffect(() => {
    Animated.timing(sheetEntrance, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    return () => sheetEntrance.stopAnimation();
  }, [sheetEntrance]);
  const { bottom: buttonBottom } = useFloatingKeyboardButton(insets.bottom);
  const { currentFont } = useTheme();
  const inputRef = useRef<TextInput>(null);
  useEffect(() => { if (ready) inputRef.current?.focus(); }, [ready]);
  return <Modal visible transparent animationType="none" onRequestClose={() => !saving && onClose()}>
    <View style={styles.overlay}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.modalOverlay, opacity: sheetEntrance }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} disabled={saving} onPress={() => { triggerLightHaptic(); return (onClose)(); }} accessibilityLabel="Close sheet" />
      </Animated.View>
      <Animated.View style={[styles.sheetFrame, keepAfterInputVisible && keyboardVisible && { height: screenHeight - insets.top - 8 }, { transform: [{ translateY: sheetEntrance.interpolate({ inputRange: [0, 1], outputRange: [screenHeight * 0.75, 0] }) }] }]}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetContent, { paddingBottom: keepAfterInputVisible && keyboardVisible ? 60 : insets.bottom + 76 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText weight="semiBold" style={styles.eyebrow}>{eyebrow}</ThemedText>
            <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
          </View>
          {onShowDetails && <TouchableOpacity disabled={saving} onPress={() => { triggerLightHaptic(); return (onShowDetails)(); }} accessibilityLabel="Prayer details"><Ionicons name="ellipsis-horizontal" size={20} color={Colors.sage} /></TouchableOpacity>}
          <TouchableOpacity style={styles.close} disabled={saving} onPress={() => { triggerLightHaptic(); return (onClose)(); }} accessibilityLabel="Close"><Ionicons name="close" size={18} color={Colors.sage} /></TouchableOpacity>
        </View>
        {!!context && !keepAfterInputVisible && <Animated.View style={{ overflow: 'hidden', height: requestCollapse.interpolate({ inputRange: [0, 72], outputRange: [requestHeight + 18, 0], extrapolate: 'clamp' }), opacity: requestCollapse.interpolate({ inputRange: [0, 48, 72], outputRange: [1, 0.15, 0], extrapolate: 'clamp' }) }}>
          <View style={[styles.requestQuote, { position: 'absolute', left: 0, right: 0 }]} onLayout={event => setRequestHeight(event.nativeEvent.layout.height)}>
            <ThemedText weight="semiBold" style={styles.requestLabel}>{contextLabel}</ThemedText>
            <ThemedText style={styles.request}>{context}</ThemedText>
          </View>
        </Animated.View>}
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ width: '100%' }}
          onLayout={event => setWritingHeight(event.nativeEvent.layout.height)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          {!!context && keepAfterInputVisible && <View style={styles.requestQuote}>
            <ThemedText weight="semiBold" style={styles.requestLabel}>{contextLabel}</ThemedText>
            <ThemedText style={styles.request}>{context}</ThemedText>
          </View>}
          {beforeInput}
          <TextInput maxLength={maxLength} ref={inputRef} autoFocus multiline scrollEnabled={false} editable={ready && !saving && editable} onContentSizeChange={event => setInputHeight(event.nativeEvent.contentSize.height)} style={[styles.input, { minHeight: afterInput ? (keepAfterInputVisible && keyboardVisible ? 72 : 180) : Math.max(280, writingHeight + 72), height: afterInput ? Math.max(keepAfterInputVisible && keyboardVisible ? 72 : 180, inputHeight) : Math.max(280, writingHeight + 72, inputHeight), fontFamily: getFontFamily(currentFont || 'lexend', 'regular') }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.placeholderText} />
          {!keepAfterInputVisible && afterInput}
        </Animated.ScrollView>
        {keepAfterInputVisible && afterInput && <Animated.ScrollView
          style={{ flexGrow: 0, flexShrink: 1, maxHeight: '65%' }}
          contentContainerStyle={{ width: '100%' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >{afterInput}</Animated.ScrollView>}
        {onDelete && <TouchableOpacity disabled={saving} style={styles.delete} onPress={() => { triggerLightHaptic(); onDelete(); }}><Ionicons name="trash-outline" size={22} color={Colors.error} /><ThemedText weight="semiBold" style={styles.deleteText}>Delete this prayer</ThemedText></TouchableOpacity>}
        </View>
      </KeyboardAvoidingView>
      </Animated.View>
      <Animated.View style={[styles.floatingSave, { bottom: buttonBottom }]}>
        <Animated.View style={{ opacity: sheetEntrance }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={saveLabel} accessibilityState={{ disabled: !ready || !value.trim() || saving || !saveEnabled, busy: saving }} disabled={!ready || !value.trim() || saving || !saveEnabled} style={[styles.save, (!ready || !value.trim() || saving || !saveEnabled) && { opacity: 0.5 }]} onPress={() => { triggerLightHaptic(); return (onSave)(); }}>
          <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheetFrame: { height: '75%' },
  sheet: { flex: 1, backgroundColor: Colors.lightBackground, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: 'center', marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  eyebrow: { color: Colors.sageMuted, fontSize: 10, lineHeight: 14, letterSpacing: 1.8, marginBottom: 5 },
  title: { fontSize: 22, lineHeight: 29, color: Colors.text, letterSpacing: -0.3 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.actionBackground, alignItems: 'center', justifyContent: 'center' },
  requestQuote: { borderLeftWidth: 2, borderLeftColor: Colors.sageMuted, paddingLeft: 12, marginBottom: 18 },
  requestLabel: { color: Colors.sageMuted, fontSize: 9, lineHeight: 13, letterSpacing: 1.5, marginBottom: 5 },
  request: { color: Colors.textGray, fontSize: 13, lineHeight: 20 },
  input: { textAlignVertical: 'top', paddingHorizontal: 0, paddingVertical: 8, color: Colors.text, fontSize: 16, lineHeight: 25 },
  delete: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 17, backgroundColor: 'rgba(217, 120, 114, 0.1)', borderRadius: 999 },
  deleteText: { color: Colors.error, fontSize: 16 },
  floatingSave: { position: 'absolute', right: 20, width: 40, height: 40 },
  save: { width: 40, height: 40, backgroundColor: Colors.sage, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.darkBackground, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
});
