import React from 'react';
import {TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {triggerLightHaptic} from '../../../utils/haptics';
import {
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  type JournalBlock,
  type JournalBlockConfig,
} from './journalBlocks';

export const JournalInlineBlock = ({
  block,
  styles,
  registerInput,
  onChangeText,
  onDelete,
  onFocus,
  onLayout,
  renderScripture,
  configOverride,
  tone = 'default',
  textPlaceholder = 'Write as you listen…',
}: {
  block: JournalBlock;
  styles: any;
  registerInput: (input: TextInput | null) => void;
  onChangeText: (value: string) => void;
  onDelete: (keepKeyboard?: boolean) => void;
  onFocus?: () => void;
  onLayout?: (layout: {y: number; height: number}) => void;
  renderScripture?: () => React.ReactNode;
  configOverride?: JournalBlockConfig;
  tone?: 'default' | 'onDark';
  textPlaceholder?: string;
}) => {
  if (block.kind === 'text' && !configOverride) {
    return (
      <TextInput
        ref={registerInput}
        style={styles.freeText}
        multiline
        placeholder={textPlaceholder}
        placeholderTextColor={
          tone === 'onDark' ? 'rgba(255,255,255,0.45)' : Colors.textGray
        }
        value={block.text}
        onChangeText={value =>
          value || !block.text ? onChangeText(value) : onDelete()
        }
        onBlur={() => {
          if (!block.text.trim()) onDelete(false);
        }}
        onLayout={event => onLayout?.(event.nativeEvent.layout)}
        onFocus={onFocus}
      />
    );
  }
  if (
    !['text', 'scripture', 'quote', 'key', 'remember', 'question', 'response'].includes(
      block.kind,
    )
  )
    return null;
  const config =
    configOverride || JOURNAL_BLOCKS[block.kind as keyof typeof JOURNAL_BLOCKS];
  return (
    <View
      style={[styles.capture, styles[`${block.kind}Capture`]]}
      onLayout={event => onLayout?.(event.nativeEvent.layout)}>
      <View style={styles.captureHeader}>
        <View style={styles.captureLabelRow}>
          <JournalBlockIcon
            config={config}
            size={14}
            color={tone === 'onDark' ? Colors.hopeWhite : Colors.sage}
          />
          <ThemedText weight="bold" style={styles.captureLabel}>
            {config.label}
          </ThemedText>
        </View>
        <TouchableOpacity
          onPress={() => {triggerLightHaptic(); onDelete();}}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons
            name="close"
            size={17}
            color={tone === 'onDark' ? 'rgba(255,255,255,0.65)' : Colors.textGray}
          />
        </TouchableOpacity>
      </View>
      {block.kind === 'scripture' ? (
        renderScripture?.()
      ) : (
        <TextInput
          ref={registerInput}
          style={[
            styles.captureInput,
            block.kind === 'quote' && styles.serifInput,
          ]}
          multiline
          placeholder={config.placeholder}
          placeholderTextColor={
            tone === 'onDark' ? 'rgba(255,255,255,0.45)' : Colors.textGray
          }
          value={block.text}
          onChangeText={onChangeText}
          onFocus={onFocus}
          autoCapitalize="sentences"
          autoCorrect
        />
      )}
    </View>
  );
};
