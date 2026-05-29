import React from 'react';
import { Platform, StyleProp, StyleSheet, TextProps, TextStyle } from 'react-native';
import ThemedText, { ThemedWeight } from './ThemedText';
import ThemedTextInput from './ThemedTextInput';

interface WrappingThemedTextProps extends Omit<TextProps, 'children'> {
  text: string;
  weight?: ThemedWeight;
  style?: StyleProp<TextStyle>;
}

const WrappingThemedText: React.FC<WrappingThemedTextProps> = ({
  text,
  weight = 'regular',
  style,
  ...textProps
}) => {
  if (Platform.OS === 'ios') {
    return (
      <ThemedTextInput
        value={text}
        weight={weight}
        editable={false}
        multiline={true}
        scrollEnabled={false}
        pointerEvents="none"
        contextMenuHidden={true}
        caretHidden={true}
        allowFontScaling={textProps.allowFontScaling}
        maxFontSizeMultiplier={textProps.maxFontSizeMultiplier}
        style={[styles.iosInput, style]}
      />
    );
  }

  return (
    <ThemedText {...textProps} weight={weight} style={style}>
      {text}
    </ThemedText>
  );
};

const styles = StyleSheet.create({
  iosInput: {
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
});

export default WrappingThemedText;
