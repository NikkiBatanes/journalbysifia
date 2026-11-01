import React from 'react';
import {StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import {
  GuidedAnswerSection,
  GuidedBibleStudy,
  GuidedBibleStudyPage,
  GuidedBibleStudyPrompt,
} from '../../data/guidedBibleStudies';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';

interface Props {
  guide: GuidedBibleStudy;
  page: GuidedBibleStudyPage;
  observation: string;
  reflection: string;
  response: string;
  prayer: string;
  revealedSections: GuidedAnswerSection[];
  onObservationChange: (text: string) => void;
  onReflectionChange: (text: string) => void;
  onResponseChange: (text: string) => void;
  onPrayerChange: (text: string) => void;
  onReveal: (section: GuidedAnswerSection) => void;
  onBlur: () => void;
}

const PageHeader = ({step, label, title, support}: {
  step: number;
  label: string;
  title: string;
  support: string;
}) => (
  <View style={styles.headerBlock}>
    <View style={styles.stageRow}>
      <View style={styles.stagePill}>
        <ThemedText weight="bold" style={styles.stagePillText}>{step} OF 6</ThemedText>
      </View>
      <ThemedText weight="semiBold" style={styles.stageLabel}>{label}</ThemedText>
    </View>
    <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
    <ThemedText style={styles.support}>{support}</ThemedText>
  </View>
);

const PromptPage = ({
  step,
  label,
  title,
  support,
  prompt,
  value,
  section,
  revealed,
  onChange,
  onReveal,
  onBlur,
}: {
  step: number;
  label: string;
  title: string;
  support: string;
  prompt: GuidedBibleStudyPrompt;
  value: string;
  section: GuidedAnswerSection;
  revealed: boolean;
  onChange: (text: string) => void;
  onReveal: () => void;
  onBlur: () => void;
}) => (
  <View style={styles.page}>
    <PageHeader step={step} label={label} title={title} support={support} />
    <View style={styles.promptCard}>
      <View style={styles.promptIcon}>
        <Ionicons name="sparkles-outline" size={17} color={Colors.sage} />
      </View>
      <ThemedText style={styles.promptQuestion}>{prompt.question}</ThemedText>
    </View>
    <View style={styles.responseCard}>
      <ThemedText weight="semiBold" style={styles.responseLabel}>YOUR RESPONSE</ThemedText>
      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={prompt.placeholder}
        placeholderTextColor={Colors.placeholderText}
        selectionColor={Colors.sage}
        cursorColor={Colors.sage}
        style={styles.input}
        accessibilityLabel={`${section.replace('_', ' ')} response`}
      />
    </View>
    <TouchableOpacity
      style={[styles.revealButton, revealed && styles.revealButtonOpen]}
      activeOpacity={0.72}
      onPress={onReveal}
      accessibilityRole="button"
      accessibilityState={{expanded: revealed}}
    >
      <View style={styles.revealCopy}>
        <Ionicons name="book-outline" size={18} color={Colors.sage} />
        <View>
          <ThemedText weight="semiBold" style={styles.revealTitle}>{revealed ? 'Hide companion insight' : prompt.guideLabel}</ThemedText>
          {!revealed ? <ThemedText style={styles.revealHint}>Compare after writing your own response</ThemedText> : null}
        </View>
      </View>
      <Ionicons name={revealed ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.sage} />
    </TouchableOpacity>
    {revealed ? (
      <View style={styles.insightCard}>
        <ThemedText weight="semiBold" style={styles.insightLabel}>COMPANION INSIGHT</ThemedText>
        <ThemedText style={styles.insightText}>{prompt.guideAnswer}</ThemedText>
      </View>
    ) : null}
    <View style={styles.spacer} />
  </View>
);

export default function GuidedBibleStudyPageView({
  guide,
  page,
  observation,
  reflection,
  response,
  prayer,
  revealedSections,
  onObservationChange,
  onReflectionChange,
  onResponseChange,
  onPrayerChange,
  onReveal,
  onBlur,
}: Props) {
  // Older in-progress sessions may still point to the retired context page.
  // Treat it as Understand so those studies resume in the combined experience.
  if (page === 'understand' || page === 'context') {
    return (
      <View style={styles.page}>
        <PageHeader step={2} label="UNDERSTAND" title="What happens here?" support="See the movement of the whole chapter before looking closer." />
        <View style={styles.overviewCard}>
          <ThemedText style={styles.overviewText}>{guide.summary}</ThemedText>
        </View>
        <View style={styles.keyVerseCard}>
          <View style={styles.keyVerseTopRow}>
            <ThemedText weight="bold" style={styles.keyVerseLabel}>KEY VERSE</ThemedText>
            <ThemedText weight="semiBold" style={styles.translation}>{guide.keyVerse.translation}</ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.keyVerseReference}>{guide.keyVerse.reference}</ThemedText>
          <ThemedText style={styles.keyVerseText}>{guide.keyVerse.text}</ThemedText>
          <View style={styles.keyVerseDivider} />
          <ThemedText style={styles.keyVerseNote}>{guide.keyVerse.note}</ThemedText>
        </View>
        <View style={styles.contextHeading}>
          <ThemedText weight="semiBold" style={styles.contextEyebrow}>HELPFUL CONTEXT</ThemedText>
          <ThemedText weight="bold" style={styles.contextHeadingTitle}>Details that make the chapter clearer.</ThemedText>
          <ThemedText style={styles.contextHeadingSupport}>A little background can help you read the passage on its own terms.</ThemedText>
        </View>
        {guide.contexts.map((context, index) => (
          <View key={context.title} style={styles.contextCard}>
            <View style={styles.contextNumber}>
              <ThemedText weight="bold" style={styles.contextNumberText}>0{index + 1}</ThemedText>
            </View>
            <View style={styles.contextCopy}>
              <ThemedText weight="bold" style={styles.contextTitle}>{context.title}</ThemedText>
              <ThemedText style={styles.contextBody}>{context.body}</ThemedText>
            </View>
          </View>
        ))}
        <View style={styles.spacer} />
      </View>
    );
  }

  if (page === 'look_again') {
    return <PromptPage step={3} label="LOOK AGAIN" title="Return to the passage." support="Notice the repeated contrast, then compare what you saw with the companion." prompt={guide.lookAgain} value={observation} section="look_again" revealed={revealedSections.includes('look_again')} onChange={onObservationChange} onReveal={() => onReveal('look_again')} onBlur={onBlur} />;
  }

  if (page === 'reflect') {
    return <PromptPage step={4} label="REFLECT" title="Let the truth examine the heart." support="Move from understanding the passage to receiving what it reveals." prompt={guide.reflect} value={reflection} section="reflect" revealed={revealedSections.includes('reflect')} onChange={onReflectionChange} onReveal={() => onReveal('reflect')} onBlur={onBlur} />;
  }

  if (page === 'respond') {
    return <PromptPage step={5} label="RESPOND" title="Carry the truth forward." support="Choose one faithful response that is concrete and possible." prompt={guide.respond} value={response} section="respond" revealed={revealedSections.includes('respond')} onChange={onResponseChange} onReveal={() => onReveal('respond')} onBlur={onBlur} />;
  }

  return (
    <View style={styles.page}>
      <PageHeader step={6} label="PRAY" title="Turn what you read into prayer." support="Begin with the companion prayer, then make the words your own." />
      <View style={styles.prayerCard}>
        <View style={styles.prayerIcon}>
          <Ionicons name="heart-outline" size={20} color={Colors.hopeWhite} />
        </View>
        <TextInput
          multiline
          value={prayer}
          onChangeText={onPrayerChange}
          onBlur={onBlur}
          placeholder="Lord Jesus…"
          placeholderTextColor="rgba(255,255,255,0.62)"
          selectionColor={Colors.hopeWhite}
          cursorColor={Colors.hopeWhite}
          style={styles.prayerInput}
          accessibilityLabel="Guided study prayer"
        />
      </View>
      <View style={styles.carryCard}>
        <Ionicons name="bookmark-outline" size={20} color={Colors.sage} />
        <ThemedText weight="semiBold" style={styles.carryLabel}>CARRY THIS WITH YOU</ThemedText>
        <ThemedText style={styles.carryText}>{guide.carryTruth}</ThemedText>
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {paddingHorizontal: 20, paddingTop: 18},
  headerBlock: {marginBottom: 24},
  stageRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14},
  stagePill: {backgroundColor: Colors.anchorBlueLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6},
  stagePillText: {fontSize: 9, letterSpacing: 1, color: Colors.sage},
  stageLabel: {fontSize: 10, letterSpacing: 1.6, color: Colors.sage},
  title: {fontFamily: Fonts.lora.bold, fontSize: 30, lineHeight: 39, color: Colors.text, marginBottom: 9},
  support: {fontSize: 14, lineHeight: 22, color: Colors.textGray},
  overviewCard: {backgroundColor: Colors.cardBackground, borderRadius: 24, borderWidth: 1, borderColor: Colors.cardBorder, padding: 21, marginBottom: 18},
  overviewText: {fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 29, color: Colors.text},
  keyVerseCard: {backgroundColor: Colors.anchorBlueLight, borderRadius: 24, padding: 21, borderLeftWidth: 4, borderLeftColor: Colors.faithGold},
  keyVerseTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  keyVerseLabel: {fontSize: 9, letterSpacing: 1.5, color: Colors.sage},
  translation: {fontSize: 10, color: Colors.textGray},
  keyVerseReference: {fontFamily: Fonts.lora.bold, fontSize: 22, color: Colors.text, marginBottom: 10},
  keyVerseText: {fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 28, color: Colors.text},
  keyVerseDivider: {height: 1, backgroundColor: Colors.cardBorder, marginVertical: 16},
  keyVerseNote: {fontSize: 14, lineHeight: 22, color: Colors.textGray},
  contextHeading: {marginTop: 30, marginBottom: 16},
  contextEyebrow: {fontSize: 9, letterSpacing: 1.5, color: Colors.sage, marginBottom: 8},
  contextHeadingTitle: {fontFamily: Fonts.lora.bold, fontSize: 23, lineHeight: 31, color: Colors.text, marginBottom: 7},
  contextHeadingSupport: {fontSize: 14, lineHeight: 22, color: Colors.textGray},
  contextCard: {flexDirection: 'row', gap: 14, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 18, marginBottom: 13},
  contextNumber: {width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center'},
  contextNumberText: {fontSize: 10, letterSpacing: 0.7, color: Colors.sage},
  contextCopy: {flex: 1},
  contextTitle: {fontFamily: Fonts.lora.bold, fontSize: 19, color: Colors.text, marginBottom: 7},
  contextBody: {fontSize: 14, lineHeight: 23, color: Colors.textGray},
  promptCard: {backgroundColor: Colors.anchorBlueLight, borderRadius: 24, padding: 21, marginBottom: 16},
  promptIcon: {width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center', marginBottom: 14},
  promptQuestion: {fontFamily: Fonts.lora.bold, fontSize: 20, lineHeight: 31, color: Colors.text},
  responseCard: {backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 19, marginBottom: 14},
  responseLabel: {fontSize: 9, letterSpacing: 1.5, color: Colors.sage, marginBottom: 9},
  input: {minHeight: 150, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 27, color: Colors.text, padding: 0, textAlignVertical: 'top'},
  revealButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(82,106,91,0.08)', borderRadius: 20, padding: 16},
  revealButtonOpen: {borderBottomLeftRadius: 10, borderBottomRightRadius: 10},
  revealCopy: {flexDirection: 'row', alignItems: 'center', gap: 11},
  revealTitle: {fontSize: 13, color: Colors.sage},
  revealHint: {fontSize: 10, color: Colors.textGray, marginTop: 2},
  insightCard: {backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, padding: 19, marginTop: 10},
  insightLabel: {fontSize: 9, letterSpacing: 1.4, color: Colors.sage, marginBottom: 9},
  insightText: {fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 28, color: Colors.text},
  prayerCard: {backgroundColor: Colors.sage, borderRadius: 26, padding: 22, marginBottom: 16},
  prayerIcon: {width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14},
  prayerInput: {minHeight: 190, fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 30, color: Colors.hopeWhite, padding: 0, textAlignVertical: 'top'},
  carryCard: {backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, padding: 21, alignItems: 'center'},
  carryLabel: {fontSize: 9, letterSpacing: 1.5, color: Colors.sage, marginTop: 10, marginBottom: 9},
  carryText: {fontFamily: Fonts.lora.bold, fontSize: 19, lineHeight: 29, color: Colors.text, textAlign: 'center'},
  spacer: {height: 130},
});
