import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';

import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import {getFontFamily} from '../../theme/fonts';

interface FocusPriorityInputsProps {
  priorities: string[];
  onChange: (index: number, text: string) => void;
  fontKey?: string;
  visibleCount?: number;
}

export interface FocusPriorityInputsHandle {
  focus: (index: number) => void;
}

const FocusPriorityInputs = forwardRef<FocusPriorityInputsHandle, FocusPriorityInputsProps>(({
  priorities,
  onChange,
  fontKey = 'lexend',
  visibleCount,
}, ref) => {
  const inputs = useRef<Array<TextInput | null>>([]);
  const filledCount = priorities.reduce((last, value, index) => value.trim() ? index + 1 : last, 0);
  const count = Math.max(visibleCount ?? priorities.length, filledCount);
  useImperativeHandle(ref, () => ({focus: index => inputs.current[index]?.focus()}), []);
  return (
    <View style={styles.container}>
      {priorities.slice(0, count).map((priority, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.numberContainer}>
            <ThemedText weight="semiBold" style={styles.number}>
              {index + 1}
            </ThemedText>
          </View>
          <TextInput
            ref={input => {inputs.current[index] = input;}}
            style={[styles.input, {fontFamily: getFontFamily(fontKey, 'regular')}]}
            value={priority}
            onChangeText={text => onChange(index, text)}
            accessibilityLabel={`Priority ${index + 1}`}
            autoFocus={index === 0}
            keyboardAppearance="light"
          />
        </View>
      ))}
    </View>
  );
});

FocusPriorityInputs.displayName = 'FocusPriorityInputs';

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  number: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 16,
    fontSize: 18,
    color: Colors.text,
    minHeight: 50,
    textAlignVertical: 'top',
  },
});

export default FocusPriorityInputs;
