import React, {useCallback, useRef} from 'react';
import {TextInput, type ColorValue, type TextInputProps} from 'react-native';
import ThemedTextInput, {
  type ThemedWeight,
} from '../../common/ThemedTextInput';
import {Colors} from '../../../theme/colors';

type Props = Omit<TextInputProps, 'selectionColor' | 'cursorColor' | 'selectionHandleColor'> & {
  accentColor?: ColorValue;
  themed?: boolean;
  weight?: ThemedWeight;
};

/** Shared by titles, writing fields and every nested block, not just the first
 * input registered for programmatic focus. Colors are present on initial mount.
 * Keep the native ref intact for focus, selection and keyboard scrolling.
 */
const JournalTextInput = React.forwardRef<TextInput, Props>(
  (
    {
      accentColor = Colors.hopeWhite,
      themed = false,
      weight = 'regular',
      onFocus,
      onPressIn,
      ...props
    },
    forwardedRef,
  ) => {
    const inputRef = useRef<TextInput | null>(null);
    const applyAccent = useCallback((input: TextInput | null) => {
      input?.setNativeProps({
        selectionColor: accentColor,
        cursorColor: accentColor,
        selectionHandleColor: accentColor,
      });
    }, [accentColor]);
    const registerInput = useCallback((input: TextInput | null) => {
      inputRef.current = input;
      // Apply before a parent ref callback can focus a newly inserted input.
      applyAccent(input);
      if (typeof forwardedRef === 'function') {
        forwardedRef(input);
      } else if (forwardedRef) {
        forwardedRef.current = input;
      }
    }, [applyAccent, forwardedRef]);
    const sharedProps = {
      ...props,
      selectionColor: accentColor,
      cursorColor: accentColor,
      selectionHandleColor: accentColor,
      onPressIn: (event: Parameters<NonNullable<TextInputProps['onPressIn']>>[0]) => {
        applyAccent(inputRef.current);
        onPressIn?.(event);
      },
      onFocus: (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
        applyAccent(inputRef.current);
        onFocus?.(event);
      },
    };

    if (themed) {
      return (
        <ThemedTextInput
          {...sharedProps}
          ref={registerInput}
          weight={weight}
        />
      );
    }

    return (
      <TextInput
        {...sharedProps}
        ref={registerInput}
      />
    );
  },
);

JournalTextInput.displayName = 'JournalTextInput';
export default JournalTextInput;
