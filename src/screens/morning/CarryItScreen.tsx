import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../components/common/ThemedText';
import StepFadeIn from '../../components/common/StepFadeIn';
import { getPsalmReflection } from '../../data/psalmReflections';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { triggerLightHaptic, triggerMediumHaptic } from '../../utils/haptics';
import { useRoutine } from '../../context/RoutineContext';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useRoutineDraft } from '../../hooks/useRoutineDraft';
import { getDailyClosingMessage } from '../../services/dailyClosingMessageService';
import {getDailyPsalmNumber} from '../../services/dailyScriptureSequence';
import {useDailyScriptureSequenceAnchor} from '../../hooks/useDailyScriptureSequenceAnchor';
import RoutineStepShell from '../../components/routine/RoutineStepShell';
import {
  createLocalReflection,
  getLocalReflection,
  getLocalReflections,
  updateLocalReflection,
} from '../../storage/reflectionStorage';

const CarryItScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const { user } = useAuth();
  const { selectedDate, markStepCompleted } = useRoutine();
  const dateStr = selectedDate;
  const {anchor: scriptureSequenceAnchor, ready: scriptureSequenceReady} = useDailyScriptureSequenceAnchor(user?.created_at);
  const dailyPsalmNumber = useMemo(
    () => getDailyPsalmNumber(selectedDate, scriptureSequenceAnchor),
    [scriptureSequenceAnchor, selectedDate],
  );
  const dailyMessage = useMemo(() => getDailyClosingMessage({
    userId: user?.id,
    date: dateStr,
    flow: 'morning',
  }), [dateStr, user?.id]);
  const routedAttributes = useMemo(
    () => Array.isArray(route.params?.selectedAttributes)
      ? route.params.selectedAttributes as string[]
      : [],
    [route.params?.selectedAttributes],
  );
  const routedCustomAttribute = typeof route.params?.customAttribute === 'string'
    ? route.params.customAttribute
    : '';
  const [psalmNumber, setPsalmNumber] = useState(dailyPsalmNumber);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(routedAttributes);
  const [showCustomInput, setShowCustomInput] = useState(Boolean(routedCustomAttribute.trim()));
  const [customAttribute, setCustomAttribute] = useState(routedCustomAttribute);
  const [psalmReflectionId, setPsalmReflectionId] = useState<string | null>(null);
  const canonicalReflectionLoaded = useRef(
    routedAttributes.length > 0 || Boolean(routedCustomAttribute.trim()),
  );
  const clearDraft = useRoutineDraft(
    'morning', selectedDate, 'carry',
    { selectedAttributes, customAttribute, showCustomInput },
    draft => {
      // A saved reflection is the source of truth while editing. An older
      // autosaved draft must not replace its selected pills after it loads.
      if (canonicalReflectionLoaded.current) { return; }
      setSelectedAttributes(draft.selectedAttributes ?? []);
      setCustomAttribute(draft.customAttribute ?? '');
      setShowCustomInput(Boolean(draft.showCustomInput));
    },
  );

  useFocusEffect(React.useCallback(() => {
    if (!scriptureSequenceReady) {return undefined;}
    let mounted = true;
    (async () => {
      const entries = await getLocalReflections('scripture', dateStr);
      if (!mounted) {return;}
      setPsalmNumber(dailyPsalmNumber);
      const existing = entries
        .filter(e => e.source === 'morning_psalm' || e.metadata?.source === 'morning_psalm')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (existing) {
        canonicalReflectionLoaded.current = true;
        const metadata = existing.metadata;
        const dailyReflection = getPsalmReflection(dailyPsalmNumber);
        const validLabels = new Set(dailyReflection.attributes.map(attribute => attribute.label));
        const contentObservations = existing.content
          .split(' · ')
          .map(observation => observation.trim())
          .filter(Boolean);
        const metadataAttributes = metadata && Array.isArray(metadata.selectedAttributes)
          ? metadata.selectedAttributes
          : [];
        const savedAttributes = metadataAttributes.length > 0
          ? metadataAttributes.filter((attribute): attribute is string =>
            typeof attribute === 'string' && validLabels.has(attribute))
          : contentObservations.filter(observation => validLabels.has(observation));
        const savedCustomAttribute = metadata && typeof metadata.customAttribute === 'string'
          ? metadata.customAttribute
          : metadataAttributes.length === 0
            ? contentObservations.find(observation => !validLabels.has(observation)) || ''
            : '';
        setSelectedAttributes(savedAttributes.length > 0 ? savedAttributes : routedAttributes);
        setCustomAttribute(savedCustomAttribute || routedCustomAttribute);
        setShowCustomInput(Boolean((savedCustomAttribute || routedCustomAttribute).trim()));
        setPsalmReflectionId(existing.id);
      }
    })();
    return () => { mounted = false; };
  }, [dailyPsalmNumber, dateStr, routedAttributes, routedCustomAttribute, scriptureSequenceReady]));

  const reflection = useMemo(() => getPsalmReflection(psalmNumber), [psalmNumber]);
  const customValue = customAttribute.trim();
  const canContinue = selectedAttributes.length > 0 || (showCustomInput && customValue.length > 0);

  const toggleAttribute = (label: string) => {
    triggerLightHaptic();
    setSelectedAttributes((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
  };

  const onNext = React.useCallback(async () => {
    if (!canContinue) { return; }
    triggerMediumHaptic();
    const observations = customValue ? [...selectedAttributes, customValue] : selectedAttributes;
    const carryText = observations.join(' · ');

    let id = psalmReflectionId;
    try {
      const metadata = {
        psalmNumber,
        psalmReference: `Psalm ${psalmNumber}`,
        selectedAttributes,
        customAttribute: customValue || undefined,
        carry: carryText,
        source: 'morning_psalm',
      };

      const upsertReflection = async (existingId: string | null) => {
        if (existingId) {
          const existing = await getLocalReflection(existingId, 'scripture', dateStr);
          if (existing) {
            const updated = await updateLocalReflection({
              ...existing,
              title: `Psalm ${psalmNumber}`,
              content: carryText,
              metadata: { ...existing.metadata, ...metadata },
            });
            return updated.id;
          }
        }
        const created = await createLocalReflection({
          title: `Psalm ${psalmNumber}`,
          content: carryText,
          type: 'scripture',
          source: 'morning_psalm',
          selected_date: dateStr,
          metadata,
        });
        return created.id;
      };

      id = await upsertReflection(id);
      setPsalmReflectionId(id);
    } catch (error) {
      console.error('Error saving morning psalm reflection:', error);
      return;
    }

    await clearDraft();
    await markStepCompleted('carry');

    navigation.navigate(route.params?.returnToClosing ? 'MorningClosing' : 'TodaysFocus');
  }, [canContinue, clearDraft, customValue, markStepCompleted, navigation, psalmNumber, psalmReflectionId, selectedAttributes, dateStr, route.params?.returnToClosing]);

  const onBack = () => navigation.navigate('PsalmOfTheDay', {
    returnToClosing: Boolean(route.params?.returnToClosing),
    psalmNumber,
  });

  const children = (
    <>
      <ThemedText style={styles.subtitle}>Choose all that stand out to you in Psalm {psalmNumber}.</ThemedText>

      <View style={styles.pills}>
        {reflection.attributes.map((attribute) => {
          const isSelected = selectedAttributes.includes(attribute.label);
          return (
            <TouchableOpacity
              key={attribute.label}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => toggleAttribute(attribute.label)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${attribute.label}, ${attribute.verses}`}
            >
              <ThemedText style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {attribute.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.pill, showCustomInput && styles.pillSelected]}
          onPress={() => {
            triggerLightHaptic();
            setShowCustomInput((current) => !current);
            if (showCustomInput) { setCustomAttribute(''); }
          }}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: showCustomInput }}
          accessibilityLabel="Something else"
        >
          <ThemedText style={[styles.pillText, showCustomInput && styles.pillTextSelected]}>
            + Something else
          </ThemedText>
        </TouchableOpacity>
      </View>

      {showCustomInput && (
        <TextInput
          style={[styles.customInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
          multiline
          autoFocus
          placeholder="Another truth about God…"
          placeholderTextColor={Colors.textGray}
          value={customAttribute}
          onChangeText={setCustomAttribute}
          textAlignVertical="top"
          keyboardAppearance="light"
        />
      )}

      <View style={styles.metadataContainer}>
        <View style={styles.verticalLine} />
        <View style={styles.metadataContent}>
          <ThemedText weight="medium" style={styles.fromText}>CARRY IT WITH YOU</ThemedText>
          <ThemedText style={styles.metadataText}>
            {dailyMessage}
          </ThemedText>
        </View>
      </View>
    </>
  );

  const footer = canContinue ? (
    <TouchableOpacity
      onPress={onNext}
      activeOpacity={0.7}
      style={styles.primaryButton}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
    </TouchableOpacity>
  ) : null;

  return (
    <RoutineStepShell
      step={5}
      totalSteps={6}
      eyebrow="PAUSE & PRAISE"
      eyebrowIcon={<Ionicons name="musical-notes" size={14} color={Colors.sage} />}
      title="What do you see about God?"
      footer={footer}
      onBack={onBack}
      backgroundColor={Colors.lightBackground}
      manageStatusBar={false}
    >
      <StepFadeIn delay={160}>
        {children}
      </StepFadeIn>
    </RoutineStepShell>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: -24,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 48,
  },
  pill: {
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  pillSelected: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  pillText: {
    fontSize: 15,
    color: Colors.text,
  },
  pillTextSelected: {
    color: Colors.hopeWhite,
  },
  customInput: {
    minHeight: 96,
    marginTop: 28,
    paddingVertical: 16,
    paddingHorizontal: 0,
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
  },
  metadataContainer: {
    marginTop: 48,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.text,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  metadataContent: {
    flex: 1,
  },
  fromText: {
    fontSize: 8,
    color: Colors.textGray,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.textGray,
    opacity: 0.6,
    lineHeight: 16,
  },
  primaryButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default CarryItScreen;
