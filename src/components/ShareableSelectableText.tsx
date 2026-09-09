import React, { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, StyleProp, StyleSheet, Text, TextInput, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { Colors } from '../theme/colors';
import { triggerLightHaptic } from '../utils/haptics';

interface ShareableSelectableTextProps {
  text: string;
  onShare?: (text: string) => void;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold';
  showShareButton?: boolean;
  shareIconColor?: string;
}

const SHAREABLE_TEXT_OPENED_EVENT = 'shareableSelectableText.opened';
let shareableTextInstanceCounter = 0;

export default function ShareableSelectableText({
  text,
  onShare,
  style,
  containerStyle,
  weight = 'regular',
  showShareButton = true,
  shareIconColor = Colors.hopeWhite,
}: ShareableSelectableTextProps) {
  const { currentFont } = useTheme();
  const [selectedText, setSelectedText] = useState('');
  const [pillVisible, setPillVisible] = useState(false);
  const selectedTextRef = useRef('');
  const instanceIdRef = useRef(`shareable-text-${++shareableTextInstanceCounter}`);
  const pillAnim = useRef(new Animated.Value(0)).current;

  const openPill = () => {
    DeviceEventEmitter.emit(SHAREABLE_TEXT_OPENED_EVENT, instanceIdRef.current);
    setPillVisible(true);
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SHAREABLE_TEXT_OPENED_EVENT, (openedId: string) => {
      if (openedId !== instanceIdRef.current) {
        selectedTextRef.current = '';
        setSelectedText('');
        setPillVisible(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: pillVisible ? 1 : 0,
      tension: 90,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [pillVisible, pillAnim]);

  useEffect(() => {
    selectedTextRef.current = '';
    setSelectedText('');
    setPillVisible(false);
  }, [text]);

  const handleSelectionChange = ({ nativeEvent }: { nativeEvent: { selection: { start: number; end: number } } }) => {
    const { start, end } = nativeEvent.selection;
    if (end > start) {
      const selection = text.slice(start, end).trim();
      selectedTextRef.current = selection;
      setSelectedText(selection);
      openPill();
    }
  };

  const clearSelection = () => {
    selectedTextRef.current = '';
    setSelectedText('');
    setPillVisible(false);
  };

  const touchStartRef = useRef(0);

  const handleTouchStart = () => {
    touchStartRef.current = Date.now();
  };

  const handleTouchEnd = () => {
    if (!onShare) { return; }
    const held = Date.now() - touchStartRef.current;
    if (held > 350) {
      if (!selectedTextRef.current) {
        const full = text.trim();
        selectedTextRef.current = full;
        setSelectedText(full);
      }
      openPill();
    }
  };

  const share = () => {
    triggerLightHaptic();
    const requestedText = selectedTextRef.current || text;
    const shareText = requestedText.trim();
    if (shareText) {
      onShare?.(shareText);
    }
    clearSelection();
  };

  return (
    <View
      style={[styles.container, containerStyle]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <TextInput
        value={text}
        editable={false}
        multiline
        scrollEnabled={false}
        contextMenuHidden={false}
        onSelectionChange={handleSelectionChange}
        style={[
          styles.text,
          style,
          { fontFamily: getFontFamily(currentFont || 'lexend', weight) },
          onShare && showShareButton && styles.textWithShare,
        ]}
      />
      {onShare && pillVisible ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.floatingPillWrap,
            {
              opacity: pillAnim,
              transform: [
                { translateY: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                { scale: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.floatingPill}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Share selection"
              onPress={share}
              activeOpacity={0.85}
              style={styles.floatingPillShare}
            >
              <Ionicons name="paper-plane-outline" size={13} color={shareIconColor} />
              <Text style={[styles.floatingPillText, { color: 'rgba(255,255,255,0.7)' }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss share"
              onPress={() => { triggerLightHaptic(); clearSelection(); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
      {onShare && showShareButton ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={selectedText ? 'Share selected text' : 'Share this reflection'}
          onPress={share}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.shareButton, selectedText ? styles.shareButtonSelected : null]}
        >
          <Ionicons name="paper-plane-outline" size={13} color={shareIconColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexShrink: 1,
    width: '100%',
  },
  text: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  textWithShare: {
    paddingRight: 38,
  },
  shareButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  floatingPillWrap: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    zIndex: 10,
    elevation: 10,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 15,
    paddingRight: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 24, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  floatingPillShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingPillText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
