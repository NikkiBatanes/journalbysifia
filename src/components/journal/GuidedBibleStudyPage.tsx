import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import {
  GuidedAnswerSection,
  GuidedBibleStudy,
  GuidedBibleStudyPrompt,
} from '../../data/guidedBibleStudies';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

interface Props {
  guide: GuidedBibleStudy;
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

const StepHeader = ({ number, label }: { number: string; label: string }) => (
  <View style={styles.stepHeader}>
    <View style={styles.stepNumber}>
      <ThemedText style={styles.stepNumberText}>{number}</ThemedText>
    </View>
    <ThemedText weight="bold" style={styles.stepLabel}>{label}</ThemedText>
  </View>
);

const PromptSection = ({
  number,
  label,
  hint,
  prompt,
  value,
  section,
  revealed,
  onChange,
  onReveal,
  onBlur,
}: {
  number: string;
  label: string;
  hint: string;
  prompt: GuidedBibleStudyPrompt;
  value: string;
  section: GuidedAnswerSection;
  revealed: boolean;
  onChange: (text: string) => void;
  onReveal: () => void;
  onBlur: () => void;
}) => (
  <View style={styles.section}>
    <StepHeader number={number} label={label} />
    <View style={[styles.questionCard, section === 'reflect' && styles.reflectCard, section === 'respond' && styles.respondCard]}>
      <ThemedText weight="semiBold" style={styles.hint}>{hint}</ThemedText>
      <ThemedText style={styles.question}>{prompt.question}</ThemedText>
      <View style={styles.notesBlock}>
        <ThemedText weight="semiBold" style={styles.notesLabel}>YOUR NOTES</ThemedText>
        <View style={styles.linedInputWrap}>
          {[1, 2, 3, 4].map(line => <View key={line} style={[styles.writeLine, {top: line * 34}]} />)}
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
      </View>
      <TouchableOpacity
        style={styles.revealButton}
        activeOpacity={0.72}
        onPress={onReveal}
        accessibilityRole="button"
        accessibilityState={{ expanded: revealed }}
      >
        <ThemedText weight="semiBold" style={styles.revealButtonText}>{revealed ? 'Hide companion answer' : prompt.guideLabel}</ThemedText>
        <Ionicons name={revealed ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.sage} />
      </TouchableOpacity>
      {revealed ? (
        <View style={styles.guideAnswer}>
          <ThemedText style={styles.guideAnswerText}>
            <ThemedText weight="bold" style={styles.answerLead}>Answer: </ThemedText>
            {prompt.guideAnswer}
          </ThemedText>
        </View>
      ) : null}
    </View>
  </View>
);

export default function GuidedBibleStudyPageView({
  guide,
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
  return (
    <View style={styles.page}>
      <View style={styles.section}>
        <StepHeader number="2" label="Understand" />
        <ThemedText style={styles.title}>What Happens Here?</ThemedText>
        <ThemedText style={styles.summary}>{guide.summary}</ThemedText>
        <View style={styles.keyVerseCard}>
          <ThemedText weight="semiBold" style={styles.keyVerseLabel}>KEY VERSE</ThemedText>
          <ThemedText weight="bold" style={styles.keyVerseReference}>{guide.keyVerse.reference} · {guide.keyVerse.translation}</ThemedText>
          <ThemedText style={styles.keyVerseText}>{guide.keyVerse.text}</ThemedText>
          <ThemedText style={styles.keyVerseNote}>{guide.keyVerse.note}</ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <StepHeader number="3" label="Know the Context" />
        <ThemedText style={styles.title}>Context that helps the chapter make sense.</ThemedText>
        {guide.contexts.map(context => (
          <View key={context.title} style={styles.contextCard}>
            <ThemedText weight="bold" style={styles.contextTitle}>{context.title}</ThemedText>
            <ThemedText style={styles.contextBody}>{context.body}</ThemedText>
          </View>
        ))}
      </View>

      <PromptSection number="4" label="Look Again" hint="GO BACK TO THE CHAPTER" prompt={guide.lookAgain} value={observation} section="look_again" revealed={revealedSections.includes('look_again')} onChange={onObservationChange} onReveal={() => onReveal('look_again')} onBlur={onBlur} />

      <PromptSection number="5" label="Reflect" hint="SIT WITH WHAT YOU READ" prompt={guide.reflect} value={reflection} section="reflect" revealed={revealedSections.includes('reflect')} onChange={onReflectionChange} onReveal={() => onReveal('reflect')} onBlur={onBlur} />

      <PromptSection number="6" label="Respond" hint="CARRY THE TRUTH FORWARD" prompt={guide.respond} value={response} section="respond" revealed={revealedSections.includes('respond')} onChange={onResponseChange} onReveal={() => onReveal('respond')} onBlur={onBlur} />

      <View style={styles.section}>
        <StepHeader number="7" label="Pray" />
        <View style={styles.prayerCard}>
          <ThemedText style={styles.prayerTitle}>Turn what you read into prayer.</ThemedText>
          <TextInput
            multiline
            value={prayer}
            onChangeText={onPrayerChange}
            onBlur={onBlur}
            placeholder="Lord Jesus…"
            placeholderTextColor="rgba(255,255,255,0.66)"
            selectionColor={Colors.hopeWhite}
            cursorColor={Colors.hopeWhite}
            style={styles.prayerInput}
            accessibilityLabel="Guided study prayer"
          />
        </View>
      </View>

      <View style={styles.carryCard}>
        <ThemedText weight="semiBold" style={styles.carryLabel}>CARRY THIS WITH YOU</ThemedText>
        <ThemedText style={styles.carryText}>{guide.carryTruth}</ThemedText>
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { marginHorizontal: 14, paddingHorizontal: 24, paddingTop: 28, backgroundColor: Colors.cardBackground },
  section: { marginBottom: 54 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.sageMuted, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: Fonts.lora.regular, fontSize: 13, color: Colors.text },
  stepLabel: { fontSize: 11, letterSpacing: 1.7, textTransform: 'uppercase', color: Colors.sage },
  title: { fontFamily: Fonts.lora.regular, fontSize: 30, lineHeight: 39, color: Colors.text, marginBottom: 18 },
  summary: { fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 30, color: Colors.text },
  keyVerseCard: { borderLeftWidth: 3, borderLeftColor: Colors.faithGold, paddingLeft: 20, paddingVertical: 7, marginTop: 34 },
  keyVerseLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.sage, marginBottom: 8 },
  keyVerseReference: { fontFamily: Fonts.lora.bold, fontSize: 22, color: Colors.text, marginBottom: 8 },
  keyVerseText: { fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 29, color: Colors.text, marginBottom: 12 },
  keyVerseNote: { fontSize: 15, lineHeight: 23, color: Colors.textGray },
  contextCard: { borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 15, padding: 20, marginBottom: 12 },
  contextTitle: { fontFamily: Fonts.lora.regular, fontSize: 20, color: Colors.text, marginBottom: 7 },
  contextBody: { fontSize: 15, lineHeight: 24, color: Colors.textGray },
  questionCard: { backgroundColor: Colors.inputBackground, borderRadius: 18, padding: 24 },
  reflectCard: { backgroundColor: Colors.anchorBlueLight },
  respondCard: { backgroundColor: Colors.lightBackground },
  hint: { fontSize: 10, letterSpacing: 1.4, color: Colors.textGray, marginBottom: 10 },
  question: { fontFamily: Fonts.lora.regular, fontSize: 21, lineHeight: 31, color: Colors.text },
  notesBlock: { marginTop: 22 },
  notesLabel: { fontSize: 9, letterSpacing: 1.3, color: Colors.sage, marginBottom: 6 },
  linedInputWrap: { minHeight: 150, position: 'relative' },
  writeLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.cardBorder },
  input: { minHeight: 150, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 34, color: Colors.text, paddingHorizontal: 0, paddingVertical: 0, textAlignVertical: 'top' },
  revealButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, marginTop: 8 },
  revealButtonText: { fontSize: 14, color: Colors.sage },
  guideAnswer: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 12, padding: 17, marginTop: 2 },
  answerLead: { fontFamily: Fonts.lora.bold, color: Colors.text },
  guideAnswerText: { fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 27, color: Colors.text },
  prayerCard: { backgroundColor: Colors.sage, borderRadius: 18, padding: 26, marginBottom: 18 },
  prayerTitle: { fontFamily: Fonts.lora.regular, fontSize: 27, lineHeight: 35, color: Colors.hopeWhite, marginBottom: 16 },
  prayerInput: { minHeight: 170, fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 29, color: Colors.hopeWhite, padding: 0, textAlignVertical: 'top' },
  carryCard: { backgroundColor: Colors.lightBackground, paddingVertical: 38, paddingHorizontal: 24, alignItems: 'center', marginHorizontal: -24 },
  carryLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.sage, marginBottom: 10 },
  carryText: { fontFamily: Fonts.lora.regular, fontSize: 25, lineHeight: 36, color: Colors.text, textAlign: 'center' },
  spacer: { height: 130 },
});
