import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
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
import {triggerLightHaptic} from '../../../utils/haptics';

const REFERENCE_PATTERN =
  /^[1-3]?\s*[a-zA-Z]+\.?\s+\d{1,3}(:\d{1,3}([–—-]\d{1,3})?(,\s*\d{1,3}([–—-]\d{1,3})?)*)?$/;

const stripWrappingQuotationMarks = (text: string) =>
  text.trim().replace(/^[“"]+|[”"]+$/g, '').trim();

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
  const [searchActive, setSearchActive] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
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
  const referenceColor = onDark ? Colors.anchorBlueLight : Colors.sage;
  const registerLookupInput = useCallback(
    (input: TextInput | null) => {
      inputRef.current = input;
      registerInput?.(input);
    },
    [registerInput],
  );
  const activateSearch = () => {
    setSearchActive(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      {(searchActive || !resolvedVerse) && (
        <View style={sharedStyles.lookupRow}>
          <JournalTextInput
            themed
            weight="semiBold"
            ref={registerLookupInput}
            style={[style, sharedStyles.lookupInput]}
            multiline={multiline}
            placeholder={placeholder}
            placeholderTextColor={
              onDark ? 'rgba(255,255,255,0.45)' : Colors.textGray
            }
            accentColor={accent}
            value={value}
            onChangeText={onChange}
            onFocus={() => {
              setSearchActive(true);
              onFocus?.();
            }}
            onBlur={() => setSearchActive(false)}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {resolving && <ActivityIndicator size="small" color={accent} />}
        </View>
      )}
      {resolvedVerse && (
        <View
          style={[
            sharedStyles.preview,
            onDark && sharedStyles.previewOnDark,
          ]}>
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Edit scripture reference"
            onPress={activateSearch}>
            <Text style={[sharedStyles.previewText, {color: foreground}]}>
              {stripWrappingQuotationMarks(resolvedVerse.text)}
            </Text>
          </TouchableOpacity>
          <View style={sharedStyles.previewReferenceRow}>
            <ThemedText
              weight="bold"
              style={[
                sharedStyles.previewReference,
                {color: referenceColor},
              ]}>
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
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={referenceColor}
              />
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
  lookupRow: {flexDirection: 'row', alignItems: 'center', gap: 9},
  lookupInput: {
    flex: 1,
    minHeight: 38,
    marginTop: 0,
    paddingHorizontal: 0,
    paddingVertical: 5,
    fontSize: 15,
    lineHeight: 21,
  },
  preview: {
    marginTop: 10,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sageMuted,
  },
  previewOnDark: {borderLeftColor: 'rgba(255,255,255,0.42)'},
  previewText: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 28,
    opacity: 0.94,
  },
  previewReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  previewReference: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
