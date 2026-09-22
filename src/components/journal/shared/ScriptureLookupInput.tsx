import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {BibleCopyrightModal} from '../../BibleCopyrightModal';
import ThemedText from '../../common/ThemedText';
import JournalTextInput from './JournalTextInput';
import {
  getScripturePassage,
  type ScriptureReaderResult,
} from '../../../services/scriptureReaderService';
import {Colors} from '../../../theme/colors';
import {Fonts} from '../../../theme/fonts';
import {triggerLightHaptic} from '../../../utils/haptics';

const REFERENCE_PATTERN =
  /^[1-3]?\s*[a-zA-Z]+\.?\s+\d{1,3}(:\d{1,3}([–—-]\d{1,3})?(,\s*\d{1,3}([–—-]\d{1,3})?)*)?$/;

export type ScriptureLookupInputProps = {
  value: string;
  placeholder: string;
  version: string;
  style: any;
  tone?: 'default' | 'onDark';
  multiline?: boolean;
  registerInput?: (input: TextInput | null) => void;
  onChange: (value: string) => void;
  onResolved: (result: ScriptureReaderResult | null) => void;
  onFocus?: () => void;
};

export const ScriptureLookupInput = ({
  value,
  placeholder,
  version,
  style,
  tone = 'default',
  multiline = false,
  registerInput,
  onChange,
  onResolved,
  onFocus,
}: ScriptureLookupInputProps) => {
  const [resolvedVerse, setResolvedVerse] =
    useState<ScriptureReaderResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const lookupVersionRef = useRef(0);
  const onResolvedRef = useRef(onResolved);
  const onDark = tone === 'onDark';

  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    const candidate = value.trim();
    const lookupId = ++lookupVersionRef.current;

    if (!REFERENCE_PATTERN.test(candidate)) {
      setResolvedVerse(null);
      setResolving(false);
      onResolvedRef.current(null);
      return;
    }

    setResolving(true);
    const timer = setTimeout(() => {
      getScripturePassage(candidate, version)
        .then(result => {
          if (lookupVersionRef.current === lookupId) {
            setResolvedVerse(result);
            onResolvedRef.current(result);
          }
        })
        .catch(() => {
          if (lookupVersionRef.current === lookupId) {
            setResolvedVerse(null);
            onResolvedRef.current(null);
          }
        })
        .finally(() => {
          if (lookupVersionRef.current === lookupId) {
            setResolving(false);
          }
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [value, version]);

  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;

  return (
    <>
      <View style={sharedStyles.lookupRow}>
        <JournalTextInput
          ref={registerInput}
          style={[style, sharedStyles.lookupInput]}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={
            onDark ? 'rgba(255,255,255,0.45)' : Colors.textGray
          }
          accentColor={accent}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {resolving && <ActivityIndicator size="small" color={accent} />}
      </View>
      {resolvedVerse && (
        <View
          style={[
            sharedStyles.preview,
            onDark && sharedStyles.previewOnDark,
          ]}>
          <ThemedText style={[sharedStyles.previewText, {color: foreground}]}>
            {resolvedVerse.text}
          </ThemedText>
          <View style={sharedStyles.previewReferenceRow}>
            <ThemedText
              weight="bold"
              style={[sharedStyles.previewReference, {color: accent}]}>
              {resolvedVerse.reference} · {resolvedVerse.version}
            </ThemedText>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                setShowCopyright(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Bible translation information">
              <Ionicons name="information-circle-outline" size={14} color={accent} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={resolvedVerse?.version || version}
      />
    </>
  );
};

const sharedStyles = StyleSheet.create({
  lookupRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  lookupInput: {flex: 1, marginTop: 0, paddingHorizontal: 0},
  preview: {
    marginTop: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
  },
  previewOnDark: {backgroundColor: 'rgba(255,255,255,0.1)'},
  previewText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  previewReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  previewReference: {fontSize: 10},
});
