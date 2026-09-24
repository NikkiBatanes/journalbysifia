import React from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {Fonts} from '../../../theme/fonts';
import {triggerLightHaptic} from '../../../utils/haptics';
import JournalTextInput from './JournalTextInput';
import NoteBlockFrame from './NoteBlockFrame';
import {ScriptureLookupInput} from './ScriptureLookupInput';
import {
  JOURNAL_BLOCKS,
  formatJournalAttribution,
  type JournalBlock,
} from './journalBlocks';
import {getNoteBlockVisuals} from './noteBlockTheme';
import type {ScriptureReaderResult} from '../../../services/scriptureReaderService';

const normalizeLink = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }
  const url = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(url) ? url : null;
};

export type JournalAdvancedBlockEditorProps = {
  block: JournalBlock;
  registerInput: (input: TextInput | null) => void;
  onChange: (changes: Partial<JournalBlock>) => void;
  onDelete: () => void;
  onFocus?: () => void;
  onLayout?: (layout: {y: number; height: number}) => void;
  onCreateSection?: (title: string) => void;
  bibleVersion?: string;
  tone?: 'default' | 'onDark';
};

export const JournalAdvancedBlockEditor = ({
  block,
  registerInput,
  onChange,
  onDelete,
  onFocus,
  onLayout,
  onCreateSection,
  bibleVersion = 'NASB',
  tone = 'default',
}: JournalAdvancedBlockEditorProps) => {
  const config = JOURNAL_BLOCKS[block.kind];
  const visuals = getNoteBlockVisuals(block.kind, tone);
  const onDark = tone === 'onDark';
  const linkUrl = block.kind === 'link' ? normalizeLink(block.text) : null;
  const selectedHistoryTypes = block.historyTypes || [];
  const selectedLanguageDetails = block.languageDetails || [];
  const inputStyle = [
    styles.input,
    {color: visuals.foreground},
    (block.kind === 'prayer' || block.kind === 'song') && styles.serifInput,
    block.kind === 'character' && styles.nameInput,
    block.kind === 'outline' && styles.titleInput,
  ];
  const secondaryStyle = [styles.secondaryInput, {color: visuals.muted}];
  const choiceStyle = (active: boolean) => [
    styles.choice,
    {
      backgroundColor: active ? visuals.accent : visuals.headerSurface,
      borderColor: active ? visuals.accent : visuals.border,
    },
  ];
  const choiceTextStyle = (active: boolean) => [
    styles.choiceText,
    {color: active ? (onDark ? Colors.sage : Colors.hopeWhite) : visuals.muted},
  ];
  const applyResolvedScripture = (result: ScriptureReaderResult | null) =>
    onChange({
      scriptureText: result?.text,
      scriptureReference: result?.reference,
      scriptureVersion: result?.version,
    });
  const toggleChoice = <T extends string>(items: T[], item: T): T[] =>
    items.includes(item)
      ? items.filter(value => value !== item)
      : [...items, item];

  return (
    <NoteBlockFrame
      kind={block.kind}
      tone={tone}
      onDelete={onDelete}
      onLayout={onLayout}>
      {block.kind !== 'history' ? (
        <JournalTextInput
          themed={block.kind !== 'prayer' && block.kind !== 'song'}
          ref={registerInput}
          accentColor={visuals.accent}
          style={inputStyle}
          multiline={!['outline', 'link', 'character', 'book'].includes(block.kind)}
          placeholder={config.placeholder}
          placeholderTextColor={visuals.placeholder}
          value={block.text}
          onChangeText={text => onChange({text})}
          onFocus={onFocus}
          keyboardType={block.kind === 'link' ? 'url' : 'default'}
          autoCapitalize={block.kind === 'link' ? 'none' : 'sentences'}
          autoCorrect={block.kind !== 'link'}
        />
      ) : null}

      {block.kind === 'reflection_question' ? (
        <>
          <ThemedText weight="bold" style={[styles.detailLabel, {color: visuals.accent}]}>
            ANSWER
          </ThemedText>
          <JournalTextInput
            themed
            accentColor={visuals.accent}
            style={[styles.input, {color: visuals.foreground}]}
            placeholder="Type your reflection…"
            placeholderTextColor={visuals.placeholder}
            value={block.note || ''}
            onChangeText={note => onChange({note})}
            onFocus={onFocus}
            multiline
          />
        </>
      ) : null}

      {block.kind === 'link' && linkUrl ? (
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel={`Open ${block.text.trim()}`}
          style={[styles.openLink, {borderColor: visuals.border, backgroundColor: visuals.headerSurface}]}
          onPress={() => {
            triggerLightHaptic();
            Linking.openURL(linkUrl).catch(() =>
              Alert.alert('Could not open link', 'Please check the address.'),
            );
          }}>
          <Ionicons name="open-outline" size={15} color={visuals.accent} />
          <ThemedText weight="bold" style={[styles.openLinkText, {color: visuals.accent}]}>
            Open link
          </ThemedText>
        </TouchableOpacity>
      ) : null}

      {block.kind === 'outline' ? (
        <>
          <View style={styles.choices}>
            {(['numbered', 'acronym', 'simple'] as const).map(option => {
              const active = (block.outlineStyle || 'numbered') === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={choiceStyle(active)}
                  onPress={() => {
                    triggerLightHaptic();
                    onChange({outlineStyle: option});
                  }}>
                  <ThemedText weight="bold" style={choiceTextStyle(active)}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          {(block.points || ['', '', '']).map((point, index) => (
            <View
              key={index}
              style={[
                styles.outlineRow,
                index === 0 && styles.firstOutlineRow,
                {borderTopColor: visuals.border},
              ]}>
              <ThemedText weight="bold" style={[styles.marker, {color: visuals.accent}]}>
                {(block.outlineStyle || 'numbered') === 'numbered'
                  ? `${index + 1}.`
                  : block.outlineStyle === 'acronym'
                    ? `${point.trim().charAt(0).toUpperCase() || '•'} —`
                    : '•'}
              </ThemedText>
              <JournalTextInput
                themed
                accentColor={visuals.accent}
                style={[styles.pointInput, {color: visuals.foreground}]}
                placeholder={`Outline point ${index + 1}`}
                placeholderTextColor={visuals.placeholder}
                value={point}
                onChangeText={value => {
                  const points = [...(block.points || ['', '', ''])];
                  points[index] = value;
                  onChange({points});
                }}
                onFocus={onFocus}
              />
              {onCreateSection ? (
                <TouchableOpacity
                  disabled={!point.trim()}
                  style={styles.sectionButton}
                  onPress={() => onCreateSection(point.trim())}>
                  <ThemedText weight="bold" style={[styles.sectionButtonText, {color: visuals.accent}]}>
                    Start section
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <TouchableOpacity
            style={styles.addPoint}
            onPress={() => {
              triggerLightHaptic();
              onChange({points: [...(block.points || ['', '', '']), '']});
            }}>
            <ThemedText weight="bold" style={[styles.addPointText, {color: visuals.accent}]}>
              ＋ Add outline point
            </ThemedText>
          </TouchableOpacity>
        </>
      ) : null}

      {block.kind === 'song' || block.kind === 'book' ? (
        <JournalTextInput
          themed
          accentColor={visuals.accent}
          style={secondaryStyle}
          placeholder={block.kind === 'song' ? '— Artist / Worship Team' : '— Author'}
          placeholderTextColor={visuals.placeholder}
          value={formatJournalAttribution(block.secondary)}
          onChangeText={secondary => onChange({secondary: formatJournalAttribution(secondary)})}
          onFocus={onFocus}
        />
      ) : null}

      {block.kind === 'character' ? (
        <>
          <JournalTextInput
            themed
            accentColor={visuals.accent}
            style={[styles.reflectionInput, {color: visuals.foreground}]}
            multiline
            placeholder="What stood out about this person?"
            placeholderTextColor={visuals.placeholder}
            value={block.note || ''}
            onChangeText={note => onChange({note})}
            onFocus={onFocus}
          />
          <ScriptureLookupInput
            value={block.secondary || ''}
            placeholder="Search related Scripture"
            version={bibleVersion}
            tone={tone}
            style={secondaryStyle}
            onChange={secondary => onChange({secondary})}
            onResolved={applyResolvedScripture}
            onFocus={onFocus}
          />
        </>
      ) : null}

      {block.kind === 'language' ? (
        <>
          <View style={styles.languageChoices}>
            {(['hebrew', 'greek', 'aramaic', 'latin'] as const).map(option => {
              const active = (block.languageKind || 'hebrew') === option;
              const labels = {hebrew: 'א Hebrew', greek: 'α Greek', aramaic: '𐡀 Aramaic', latin: 'L Latin'};
              return (
                <TouchableOpacity
                  key={option}
                  style={[choiceStyle(active), styles.languageChoice]}
                  onPress={() => {
                    triggerLightHaptic();
                    onChange({languageKind: option});
                  }}>
                  <ThemedText weight="bold" style={choiceTextStyle(active)}>{labels[option]}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.choices}>
            {(['meaning', 'transliteration', 'origin', 'scripture'] as const).map(option => {
              const active = selectedLanguageDetails.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  style={choiceStyle(active)}
                  onPress={() => {
                    triggerLightHaptic();
                    onChange({languageDetails: toggleChoice(selectedLanguageDetails, option)});
                  }}>
                  <ThemedText weight="bold" style={choiceTextStyle(active)}>
                    {option === 'origin' ? 'Word Origin' : option[0].toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedLanguageDetails.includes('meaning') ? (
            <JournalTextInput themed accentColor={visuals.accent} style={[styles.input, styles.detailInput, {color: visuals.foreground}]} multiline placeholder="What does this word mean here?" placeholderTextColor={visuals.placeholder} value={block.meaning || ''} onChangeText={meaning => onChange({meaning})} onFocus={onFocus} />
          ) : null}
          {selectedLanguageDetails.includes('transliteration') ? (
            <JournalTextInput themed accentColor={visuals.accent} style={secondaryStyle} placeholder="Transliteration / pronunciation" placeholderTextColor={visuals.placeholder} value={block.secondary || ''} onChangeText={secondary => onChange({secondary})} onFocus={onFocus} />
          ) : null}
          {selectedLanguageDetails.includes('origin') ? (
            <JournalTextInput themed accentColor={visuals.accent} style={[styles.input, styles.detailInput, {color: visuals.foreground}]} multiline placeholder="Where does this word come from?" placeholderTextColor={visuals.placeholder} value={block.origin || ''} onChangeText={origin => onChange({origin})} onFocus={onFocus} />
          ) : null}
          {selectedLanguageDetails.includes('scripture') ? (
            <ScriptureLookupInput value={block.reference || ''} placeholder="Search related Scripture" version={bibleVersion} tone={tone} style={secondaryStyle} onChange={reference => onChange({reference})} onResolved={applyResolvedScripture} onFocus={onFocus} />
          ) : null}
        </>
      ) : null}

      {block.kind === 'history' ? (
        <>
          <View style={styles.choices}>
            {(['era', 'place', 'culture', 'custom', 'politics'] as const).map(option => {
              const active = selectedHistoryTypes.includes(option);
              return (
                <TouchableOpacity key={option} style={choiceStyle(active)} onPress={() => {
                  triggerLightHaptic();
                  onChange({historyTypes: toggleChoice(selectedHistoryTypes, option)});
                }}>
                  <ThemedText weight="bold" style={choiceTextStyle(active)}>{option[0].toUpperCase() + option.slice(1)}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedHistoryTypes.includes('era') || selectedHistoryTypes.includes('place') ? (
            <View style={[styles.detailRow, {borderColor: visuals.border, backgroundColor: visuals.headerSurface}]}>
              {selectedHistoryTypes.includes('place') ? <Ionicons name="location-outline" size={17} color={visuals.accent} /> : null}
              <JournalTextInput
                themed
                ref={registerInput}
                accentColor={visuals.accent}
                style={[styles.secondaryInput, styles.detailRowInput, {color: visuals.foreground}]}
                placeholder={selectedHistoryTypes.includes('era') ? 'Year or period' : 'Ephesus or modern-day Turkey'}
                placeholderTextColor={visuals.placeholder}
                value={block.secondary || ''}
                onChangeText={secondary => onChange({secondary})}
                onFocus={onFocus}
              />
              {selectedHistoryTypes.includes('era')
                ? (['BC', 'AD'] as const).map(period => {
                    const active = (block.eraPeriod || 'AD') === period;
                    return (
                      <TouchableOpacity key={period} style={choiceStyle(active)} onPress={() => onChange({eraPeriod: period})}>
                        <ThemedText weight="bold" style={choiceTextStyle(active)}>{period}</ThemedText>
                      </TouchableOpacity>
                    );
                  })
                : null}
            </View>
          ) : null}
          <JournalTextInput themed accentColor={visuals.accent} style={[styles.input, styles.detailInput, {color: visuals.foreground}]} multiline placeholder="What background helps explain this passage?" placeholderTextColor={visuals.placeholder} value={block.note || ''} onChangeText={note => onChange({note})} onFocus={onFocus} />
          <ScriptureLookupInput value={block.reference || ''} placeholder="Search related Scripture" version={bibleVersion} tone={tone} style={secondaryStyle} onChange={reference => onChange({reference})} onResolved={applyResolvedScripture} onFocus={onFocus} />
        </>
      ) : null}
    </NoteBlockFrame>
  );
};

const styles = StyleSheet.create({
  input: {minHeight: 54, paddingTop: 9, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21, textAlignVertical: 'top'},
  serifInput: {fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 24},
  nameInput: {minHeight: 38, paddingTop: 7, fontSize: 16, lineHeight: 21},
  titleInput: {fontFamily: Fonts.bold, fontSize: 16, lineHeight: 24},
  secondaryInput: {paddingTop: 7, fontFamily: Fonts.regular, fontSize: 12},
  reflectionInput: {minHeight: 46, marginTop: 2, paddingTop: 5, fontFamily: Fonts.regular, fontSize: 13, lineHeight: 19},
  detailLabel: {fontSize: 10, letterSpacing: 1, marginTop: 12},
  detailInput: {marginTop: 8},
  choices: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10},
  languageChoices: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10},
  languageChoice: {flexGrow: 1, flexBasis: '47%', alignItems: 'center'},
  choice: {paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderRadius: 16},
  choiceText: {fontSize: 10},
  openLink: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderRadius: 18},
  openLinkText: {fontSize: 11},
  outlineRow: {flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, paddingVertical: 8},
  firstOutlineRow: {marginTop: 12},
  marker: {width: 20, fontSize: 11, textAlign: 'center'},
  pointInput: {flex: 1, minHeight: 38, fontFamily: Fonts.regular, fontSize: 13},
  sectionButton: {paddingHorizontal: 7, paddingVertical: 7},
  sectionButtonText: {fontSize: 9},
  addPoint: {paddingTop: 9, alignSelf: 'flex-start'},
  addPointText: {fontSize: 11},
  detailRow: {flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9, paddingHorizontal: 10, borderWidth: 1, borderRadius: 12},
  detailRowInput: {flex: 1, minHeight: 42, paddingTop: 0},
});

export default JournalAdvancedBlockEditor;
