import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';

interface ShareableSelectableTextProps {
  text: string;
  onShare?: (text: string) => void;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold';
}

export default function ShareableSelectableText({
  text,
  onShare,
  style,
  containerStyle,
  weight = 'regular',
}: ShareableSelectableTextProps) {
  const { currentFont } = useTheme();
  const [selectedText, setSelectedText] = useState('');
  const selectedTextRef = useRef('');

  useEffect(() => {
    selectedTextRef.current = '';
    setSelectedText('');
  }, [text]);

  const handleSelectionChange = ({ nativeEvent }: { nativeEvent: { selection: { start: number; end: number } } }) => {
    const { start, end } = nativeEvent.selection;
    if (end > start) {
      const selection = text.slice(start, end).trim();
      selectedTextRef.current = selection;
      setSelectedText(selection);
    }
  };

  const share = () => {
    const requestedText = selectedTextRef.current || text;
    const shareText = requestedText.trim();
    if (shareText) {
      onShare?.(shareText);
    }
    selectedTextRef.current = '';
    setSelectedText('');
  };

  return (
    <View style={[styles.container, containerStyle]}>
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
          onShare && styles.textWithShare,
        ]}
      />
      {onShare ? (
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
});
