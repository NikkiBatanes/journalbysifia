import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, Text, TextInput, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';

interface ShareableSelectableTextProps {
  text: string;
  onShare?: (text: string) => void;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold';
  showShareButton?: boolean;
}

export default function ShareableSelectableText({
  text,
  onShare,
  style,
  containerStyle,
  weight = 'regular',
  showShareButton = true,
}: ShareableSelectableTextProps) {
  const { currentFont } = useTheme();
  const [selectedText, setSelectedText] = useState('');
  const [pillVisible, setPillVisible] = useState(false);
  const selectedTextRef = useRef('');
  const pillAnim = useRef(new Animated.Value(0)).current;

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
      setPillVisible(true);
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
      setPillVisible(true);
    }
  };

  const share = () => {
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
              <Ionicons name="share-outline" size={16} color="#E8B86D" />
              <Text style={styles.floatingPillText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss share"
              onPress={clearSelection}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={14} color="rgba(232,184,109,0.7)" />
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
          <Ionicons name="share-outline" size={18} color="#E8B86D" />
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
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonSelected: {
    backgroundColor: 'rgba(232,184,109,0.14)',
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
    borderColor: 'rgba(232,184,109,0.35)',
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
    color: '#E8B86D',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
