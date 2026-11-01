import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import {
  GuidedAnswerSection,
  GuidedBibleStudy,
  GuidedBibleStudyPage,
  GuidedBibleStudyPrompt,
} from '../../data/guidedBibleStudies';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

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

const Heading = ({ step, title, lead }: { step: string; title: string; lead: string }) => (
  <>
    <ThemedText weight="semiBold" style={styles.eyebrow}>{step}</ThemedText>
    <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
    <ThemedText style={styles.lead}>{lead}</ThemedText>
  </>
);

const PromptPage = ({
  step,
  title,
  lead,
  prompt,
  value,
  section,
  revealed,
  onChange,
  onReveal,
  onBlur,
}: {
  step: string;
  title: string;
  lead: string;
  prompt: GuidedBibleStudyPrompt;
  value: string;
  section: GuidedAnswerSection;
  revealed: boolean;
  onChange: (text: string) => void;
  onReveal: () => void;
  onBlur: () => void;
}) => (
  <View style={styles.page}>
    <Heading step={step} title={title} lead={lead} />
    <View style={styles.questionCard}>
      <ThemedText weight="semiBold" style={styles.question}>{prompt.question}</ThemedText>
    </View>
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
    <TouchableOpacity
      style={[styles.revealButton, revealed && styles.revealButtonOpen]}
      activeOpacity={0.72}
      onPress={onReveal}
      accessibilityRole="button"
      accessibilityState={{ expanded: revealed }}
    >
      <ThemedText weight="semiBold" style={styles.revealButtonText}>{prompt.guideLabel}</ThemedText>
      <Ionicons name={revealed ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.sage} />
    </TouchableOpacity>
    {revealed ? (
      <View style={styles.guideAnswer}>
        <ThemedText weight="semiBold" style={styles.guideAnswerLabel}>GUIDE</ThemedText>
        <ThemedText style={styles.guideAnswerText}>{prompt.guideAnswer}</ThemedText>
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
  if (page === 'understand') {
    return (
      <View style={styles.page}>
        <Heading step="2 · Understand" title="What happens here?" lead="Begin with the main movement of the chapter before looking more closely." />
        <View style={styles.summaryCard}>
          <ThemedText style={styles.summary}>{guide.summary}</ThemedText>
        </View>
        <View style={styles.keyVerseCard}>
          <ThemedText weight="semiBold" style={styles.keyVerseLabel}>KEY VERSE</ThemedText>
          <ThemedText weight="bold" style={styles.keyVerseReference}>{guide.keyVerse.reference} · {guide.keyVerse.translation}</ThemedText>
          <ThemedText style={styles.keyVerseText}>{guide.keyVerse.text}</ThemedText>
          <ThemedText style={styles.keyVerseNote}>{guide.keyVerse.note}</ThemedText>
        </View>
        <View style={styles.spacer} />
      </View>
    );
  }

  if (page === 'context') {
    return (
      <View style={styles.page}>
        <Heading step="3 · Know the context" title="Context that helps the chapter make sense." lead="These details help us read the passage on its own terms." />
        {guide.contexts.map(context => (
          <View key={context.title} style={styles.contextCard}>
            <ThemedText weight="bold" style={styles.contextTitle}>{context.title}</ThemedText>
            <ThemedText style={styles.contextBody}>{context.body}</ThemedText>
          </View>
        ))}
        <View style={styles.spacer} />
      </View>
    );
  }

  if (page === 'look_again') {
    return <PromptPage step="4 · Look again" title="Return to the text." lead="Answer from what you can see in the passage, then compare your observation with the guide." prompt={guide.lookAgain} value={observation} section="look_again" revealed={revealedSections.includes('look_again')} onChange={onObservationChange} onReveal={() => onReveal('look_again')} onBlur={onBlur} />;
  }

  if (page === 'reflect') {
    return <PromptPage step="5 · Reflect" title="Sit with what you read." lead="Let the meaning of the passage reach beyond information and examine the heart." prompt={guide.reflect} value={reflection} section="reflect" revealed={revealedSections.includes('reflect')} onChange={onReflectionChange} onReveal={() => onReveal('reflect')} onBlur={onBlur} />;
  }

  if (page === 'respond') {
    return <PromptPage step="6 · Respond" title="Carry the truth forward." lead="Name one response that is concrete, faithful, and possible." prompt={guide.respond} value={response} section="respond" revealed={revealedSections.includes('respond')} onChange={onResponseChange} onReveal={() => onReveal('respond')} onBlur={onBlur} />;
  }

  return (
    <View style={styles.page}>
      <Heading step="7 · Pray" title="Turn what you read into prayer." lead="Use these words as a beginning, then make the prayer your own." />
      <View style={styles.prayerCard}>
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
      <View style={styles.carryCard}>
        <ThemedText weight="semiBold" style={styles.carryLabel}>CARRY THIS WITH YOU</ThemedText>
        <ThemedText style={styles.carryText}>{guide.carryTruth}</ThemedText>
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 1.7, textTransform: 'uppercase', color: Colors.sage, marginBottom: 8 },
  title: { fontFamily: Fonts.lora.bold, fontSize: 30, lineHeight: 38, color: Colors.text, marginBottom: 10 },
  lead: { fontSize: 15, lineHeight: 23, color: Colors.textGray, marginBottom: 20 },
  summaryCard: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 22, padding: 20, marginBottom: 14 },
  summary: { fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 29, color: Colors.text },
  keyVerseCard: { borderLeftWidth: 3, borderLeftColor: '#B89B67', paddingLeft: 18, paddingVertical: 8, marginTop: 10 },
  keyVerseLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.sage, marginBottom: 8 },
  keyVerseReference: { fontFamily: Fonts.lora.bold, fontSize: 22, color: Colors.text, marginBottom: 8 },
  keyVerseText: { fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 29, color: Colors.text, marginBottom: 12 },
  keyVerseNote: { fontSize: 15, lineHeight: 23, color: Colors.textGray },
  contextCard: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 20, padding: 19, marginBottom: 13 },
  contextTitle: { fontFamily: Fonts.lora.bold, fontSize: 19, color: Colors.text, marginBottom: 8 },
  contextBody: { fontSize: 15, lineHeight: 24, color: Colors.textGray },
  questionCard: { backgroundColor: Colors.anchorBlueLight, borderRadius: 20, padding: 19, marginBottom: 18 },
  question: { fontFamily: Fonts.lora.bold, fontSize: 19, lineHeight: 29, color: Colors.text },
  input: { minHeight: 130, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 27, color: Colors.text, paddingHorizontal: 4, paddingVertical: 8, textAlignVertical: 'top' },
  revealButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.cardBorder, paddingVertical: 15, marginTop: 8 },
  revealButtonOpen: { borderBottomWidth: 0 },
  revealButtonText: { fontSize: 14, color: Colors.sage },
  guideAnswer: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 8 },
  guideAnswerLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.sage, marginBottom: 9 },
  guideAnswerText: { fontFamily: Fonts.lora.regular, fontSize: 16, lineHeight: 27, color: Colors.text },
  prayerCard: { backgroundColor: Colors.sage, borderRadius: 22, padding: 20, marginBottom: 18 },
  prayerInput: { minHeight: 170, fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 29, color: Colors.hopeWhite, padding: 0, textAlignVertical: 'top' },
  carryCard: { backgroundColor: Colors.anchorBlueLight, borderRadius: 20, padding: 20, alignItems: 'center' },
  carryLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.sage, marginBottom: 10 },
  carryText: { fontFamily: Fonts.lora.bold, fontSize: 19, lineHeight: 29, color: Colors.text, textAlign: 'center' },
  spacer: { height: 130 },
});
