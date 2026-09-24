import React from 'react';
import {TextInput} from 'react-native';
import JournalTextInput from './JournalTextInput';
import {useTheme} from '../../../hooks/useTheme';
import {getFontFamily} from '../../../theme/fonts';
import {
  JOURNAL_BLOCKS,
  formatJournalAttribution,
  type JournalBlock,
  type JournalBlockConfig,
} from './journalBlocks';
import {getNoteBlockVisuals} from './noteBlockTheme';
import NoteBlockFrame from './NoteBlockFrame';

export const JournalInlineBlock = ({
  block,
  styles,
  registerInput,
  onChangeText,
  onChangeSecondary,
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
  onChangeSecondary?: (value: string) => void;
  onDelete: (keepKeyboard?: boolean) => void;
  onFocus?: () => void;
  onLayout?: (layout: {y: number; height: number}) => void;
  renderScripture?: () => React.ReactNode;
  configOverride?: JournalBlockConfig;
  tone?: 'default' | 'onDark';
  textPlaceholder?: string;
}) => {
  const {currentFont} = useTheme();
  const attributionFontFamily = getFontFamily(
    currentFont || 'lexend',
    'regular',
  );
  const visuals = getNoteBlockVisuals(block.kind, tone);
  const accent = visuals.accent;

  if (block.kind === 'text' && !configOverride) {
    return (
      <JournalTextInput
        themed
        ref={registerInput}
        accentColor={accent}
        style={styles.freeText}
        multiline
        placeholder={textPlaceholder}
        placeholderTextColor={visuals.placeholder}
        value={block.text}
        onChangeText={value =>
          value || !block.text ? onChangeText(value) : onDelete()
        }
        onBlur={() => {
          if (!block.text.trim()) {
            onDelete(false);
          }
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
  ) {
    return null;
  }
  const config =
    configOverride || JOURNAL_BLOCKS[block.kind as keyof typeof JOURNAL_BLOCKS];
  return (
    <NoteBlockFrame
      kind={block.kind}
      tone={tone}
      onDelete={() => onDelete()}
      onLayout={onLayout}
      style={[styles.capture, styles[`${block.kind}Capture`]]}>
      {block.kind === 'scripture' ? (
        renderScripture?.()
      ) : (
        <>
          <JournalTextInput
            themed={block.kind !== 'quote'}
            ref={registerInput}
            accentColor={accent}
            style={[
              styles.captureInput,
              block.kind === 'quote' && styles.serifInput,
            ]}
            multiline
            placeholder={config.placeholder}
            placeholderTextColor={visuals.placeholder}
            value={block.text}
            onChangeText={onChangeText}
            onFocus={onFocus}
            autoCapitalize="sentences"
            autoCorrect
          />
          {block.kind === 'quote' && onChangeSecondary && (
            <JournalTextInput
              themed
              accentColor={accent}
              style={[
                styles.secondaryInput,
                {fontFamily: attributionFontFamily},
              ]}
              placeholder="— Speaker / Author"
              placeholderTextColor={visuals.placeholder}
              value={formatJournalAttribution(block.secondary)}
              onChangeText={value =>
                onChangeSecondary(formatJournalAttribution(value))
              }
              onFocus={onFocus}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}
        </>
      )}
    </NoteBlockFrame>
  );
};
