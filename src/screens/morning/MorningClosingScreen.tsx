import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';

import ThemedText from '../../components/common/ThemedText';
import TruthToCarryShareComposer from '../../components/TruthToCarryShareComposer';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';
import { toLocalDateString } from '../../utils/date';
import { useCreateJournalEntry } from '../../services/hooks/useJournalData';

type SummaryIconType = 'ionicons' | 'material' | 'fontawesome';

const SummaryIcon = ({ icon, iconType }: { icon?: string; iconType?: SummaryIconType }) => {
  if (!icon || !iconType) { return null; }
  if (iconType === 'material') {
    return <MaterialCommunityIcons name={icon as any} size={18} color={Colors.sage} />;
  }
  if (iconType === 'fontawesome') {
    return <FontAwesome6 name={icon as any} size={17} color={Colors.sage} />;
  }
  return <Ionicons name={icon as any} size={18} color={Colors.sage} />;
};

const DetailSection = ({ label, values, emptyText }: { label: string; values: string[]; emptyText: string }) => (
  <View style={styles.detailSection}>
    <ThemedText weight="semiBold" style={styles.detailLabel}>{label}</ThemedText>
    {values.length > 0 ? values.map((value, index) => (
      <ThemedText key={`${value}-${index}`} style={styles.detailValue}>{value}</ThemedText>
    )) : (
      <ThemedText style={styles.detailValueMuted}>{emptyText}</ThemedText>
    )}
  </View>
);

const MorningClosingScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const createMutation = useCreateJournalEntry();
  const params = route.params ?? {};
  const isStandaloneCheckIn = params.standalone === true;
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [shareComposerVisible, setShareComposerVisible] = useState(false);
  useMorningStatusBar();

  const feeling: string | undefined = params.feeling;
  const underneath: string | undefined = params.underneath;
  const focus: string | undefined = params.focus;
  const focusReflection: string | undefined = params.personalText;
  const priorities: string[] = (params.priorities ?? [])
    .map((priority: any) => priority.text ?? priority)
    .filter((priority: string) => priority.trim());
  const topTodos: string[] = (params.topTodos ?? []).filter((todo: string) => todo.trim());
  const selectedAttributes: string[] = params.selectedAttributes ?? [];
  const carry: string | undefined = params.carry;
  const checkedInAt = useMemo(() => new Date().toISOString(), []);
  const date = params.selectedDate ? new Date(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(date);
  const priorityCountLabel = `${priorities.length} ${priorities.length === 1 ? 'priority' : 'priorities'}`;
  const todoCountLabel = `${topTodos.length} ${topTodos.length === 1 ? 'to-do' : 'to-dos'}`;
  const shareText = isStandaloneCheckIn
    ? [
        'MY MORNING CHECK-IN',
        feeling ? `Today I named: ${feeling}` : '',
        underneath || '',
      ].filter(Boolean).join('\n\n')
    : [
        'MY MORNING WITH GOD',
        params.psalmNumber ? `Psalm ${params.psalmNumber}` : '',
        selectedAttributes.length > 0 ? `What I saw about God\n${selectedAttributes.join(' · ')}` : '',
        feeling ? `Feeling: ${feeling}` : '',
        focus ? `Focus: ${focus}` : '',
        'Remember who God is as you step into today.',
      ].filter(Boolean).join('\n\n');

  const onDone = async () => {
    triggerLightHaptic();

    if (user) {
      try {
        const content = JSON.stringify({
          feeling,
          feelingIcon: params.feelingIcon,
          feelingIconType: params.feelingIconType,
          underneath,
          focus,
          focusIcon: params.focusIcon,
          focusIconType: params.focusIconType,
          focusCategory: params.focusCategory,
          customFocus: params.customFocus,
          personalText: params.personalText,
          priorities: params.priorities,
          topTodos,
          psalm: params.psalmNumber,
          psalmRead: params.psalmRead,
          selectedAttributes: params.selectedAttributes,
          customAttribute: params.customAttribute,
          carry,
          checkedInAt,
        });

        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content_type: 'morning_flow',
          content,
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to save your morning. Please try again.');
        return;
      }
    }

    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Today' });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.completionHeader}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={30} color={Colors.hopeWhite} />
          </View>
          <View style={styles.completionHeaderText}>
            <ThemedText style={styles.title}>{isStandaloneCheckIn ? 'Check-in saved.' : "You're ready for today."}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {isStandaloneCheckIn ? 'You made space to notice what is happening within.' : 'You’ve begun your day with God.'}
            </ThemedText>
          </View>
        </View>

        {isStandaloneCheckIn ? (
          <View style={styles.standaloneCard}>
            <ThemedText style={styles.glanceLabel}>FEELING</ThemedText>
            <View style={styles.valueWithIcon}>
              <SummaryIcon icon={params.feelingIcon} iconType={params.feelingIconType} />
              <ThemedText weight="semiBold" style={styles.glanceValue}>{feeling || '—'}</ThemedText>
            </View>
            <View style={styles.standaloneDivider} />
            <ThemedText weight="semiBold" style={styles.detailLabel}>What’s on your heart</ThemedText>
            <ThemedText style={underneath ? styles.detailValue : styles.detailValueMuted}>
              {underneath || 'No note added'}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.glanceSection}>
              <ThemedText weight="semiBold" style={styles.sectionEyebrow}>TODAY AT A GLANCE</ThemedText>
              <View style={styles.glanceGrid}>
                <View style={[styles.glanceColumn, styles.glanceColumnBorder]}>
                  <ThemedText style={styles.glanceLabel}>Feeling</ThemedText>
                  <View style={styles.valueWithIcon}>
                    <SummaryIcon icon={params.feelingIcon} iconType={params.feelingIconType} />
                    <ThemedText weight="semiBold" style={styles.glanceValue}>{feeling || '—'}</ThemedText>
                  </View>
                </View>
                <View style={styles.glanceColumn}>
                  <ThemedText style={styles.glanceLabel}>Focus</ThemedText>
                  <View style={styles.valueWithIcon}>
                    <SummaryIcon icon={params.focusIcon} iconType={params.focusIconType} />
                    <ThemedText weight="semiBold" style={styles.glanceValue}>{focus || 'Open'}</ThemedText>
                  </View>
                  {focusReflection ? (
                    <ThemedText style={styles.focusReflection}>{focusReflection}</ThemedText>
                  ) : null}
                </View>
              </View>
              <View style={styles.todayCount}>
                <ThemedText style={styles.glanceLabel}>Today</ThemedText>
                <ThemedText weight="semiBold" style={styles.todayCountValue}>
                  {priorityCountLabel} · {todoCountLabel}
                </ThemedText>
              </View>
            </View>

            <View style={styles.psalmCard}>
              <View style={styles.psalmHeader}>
                <ThemedText weight="semiBold" style={styles.sectionEyebrow}>MORNING PSALM</ThemedText>
                <ThemedText weight="bold" style={styles.psalmTitle}>
                  {params.psalmNumber ? `Psalm ${params.psalmNumber}` : 'Psalm'}
                </ThemedText>
              </View>

              <View style={styles.readStatus}>
                <View style={[styles.readStatusIcon, !params.psalmRead && styles.readStatusIconInactive]}>
                  <Ionicons name={params.psalmRead ? 'checkmark' : 'book-outline'} size={14} color={params.psalmRead ? Colors.hopeWhite : Colors.sage} />
                </View>
                <ThemedText weight="semiBold" style={styles.readStatusText}>
                  {params.psalmRead ? 'Full chapter read' : 'Chapter not marked read'}
                </ThemedText>
              </View>

              <ThemedText style={styles.psalmPrompt}>What you saw about God</ThemedText>
              <ThemedText weight="bold" style={selectedAttributes.length > 0 ? styles.psalmAnswer : styles.psalmAnswerMuted}>
                {selectedAttributes.length > 0 ? selectedAttributes.join(' · ') : 'Nothing selected'}
              </ThemedText>

              <TouchableOpacity
                style={styles.detailsToggle}
                onPress={() => {
                  triggerLightHaptic();
                  setDetailsExpanded((current) => !current);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsExpanded }}
              >
                <ThemedText weight="semiBold" style={styles.detailsToggleText}>
                  {detailsExpanded ? 'Hide morning details' : 'View morning details'}
                </ThemedText>
                <Ionicons name={detailsExpanded ? 'arrow-up' : 'arrow-down'} size={17} color={Colors.sage} />
              </TouchableOpacity>

              {detailsExpanded && (
                <View style={styles.detailsContent}>
                  <DetailSection label="What’s on your heart" values={underneath ? [underneath] : []} emptyText="No note added" />
                  <DetailSection label="Top priorities" values={priorities} emptyText="No priorities added" />
                  <DetailSection label="To-dos" values={topTodos.slice(0, 3)} emptyText="No to-dos added" />
                  {topTodos.length > 3 && (
                    <ThemedText weight="semiBold" style={styles.moreText}>+ {topTodos.length - 3} more</ThemedText>
                  )}
                </View>
              )}
            </View>

            <View style={styles.asYouGo}>
              <ThemedText weight="semiBold" style={styles.sectionEyebrow}>AS YOU GO</ThemedText>
              <ThemedText weight="bold" style={styles.reminderText}>
                Remember who God is as{'\n'}you step into today.
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.shareButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Share morning reflection"
          onPress={() => {
            triggerLightHaptic();
            setShareComposerVisible(true);
          }}
        >
          <Ionicons name="paper-plane-outline" size={21} color={Colors.sage} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Save and finish"
          onPress={onDone}
        >
          <ThemedText weight="semiBold" style={styles.doneButtonText}>Save & Finish</ThemedText>
        </TouchableOpacity>
      </View>

      <TruthToCarryShareComposer
        visible={shareComposerVisible}
        text={shareText}
        noSplit
        userId={user?.id || ''}
        onClose={() => setShareComposerVisible(false)}
        onUpgrade={() => {
          const parent = navigation.getParent();
          (parent ?? navigation).navigate('OnboardingSalesOffer', {
            upgradeMode: true,
            currentTier: 'seeker',
            selectedTier: 'growth',
            source: 'sifia_reflection_watermark',
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 38,
  },
  completionHeaderText: {
    flex: 1,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 4,
  },
  sectionEyebrow: {
    color: Colors.sageMuted,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.8,
  },
  glanceSection: {
    marginBottom: 34,
  },
  glanceGrid: {
    flexDirection: 'row',
    marginTop: 14,
  },
  glanceColumn: {
    flex: 1,
    paddingVertical: 2,
    paddingLeft: 22,
  },
  glanceColumnBorder: {
    paddingLeft: 0,
    paddingRight: 22,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
  },
  glanceLabel: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  valueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  glanceValue: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 23,
    flexShrink: 1,
  },
  focusReflection: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  todayCount: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 20,
    paddingTop: 18,
  },
  todayCountValue: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 24,
  },
  psalmCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 26,
  },
  psalmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 14,
  },
  psalmTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 24,
  },
  readStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 26,
  },
  readStatusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readStatusIconInactive: {
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.22)',
  },
  readStatusText: {
    color: Colors.sage,
    fontSize: 13,
    lineHeight: 18,
  },
  psalmPrompt: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  psalmAnswer: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 30,
  },
  psalmAnswerMuted: {
    color: Colors.textGray,
    fontSize: 18,
    lineHeight: 26,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 22,
    paddingVertical: 4,
  },
  detailsToggleText: {
    color: Colors.sage,
    fontSize: 14,
    lineHeight: 20,
  },
  detailsContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 22,
    paddingTop: 4,
  },
  detailSection: {
    marginTop: 24,
    gap: 5,
  },
  detailLabel: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  detailValue: {
    color: Colors.textGray,
    fontSize: 16,
    lineHeight: 23,
  },
  detailValueMuted: {
    color: Colors.textGray,
    fontSize: 16,
    lineHeight: 23,
    opacity: 0.8,
  },
  moreText: {
    color: Colors.sage,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 7,
  },
  asYouGo: {
    alignItems: 'center',
    marginTop: 38,
    paddingBottom: 8,
  },
  reminderText: {
    color: Colors.text,
    fontSize: 21,
    lineHeight: 29,
    textAlign: 'center',
    marginTop: 12,
  },
  standaloneCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 26,
    padding: 24,
  },
  standaloneDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  shareButton: {
    minHeight: 56,
    paddingHorizontal: 18,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.sage,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  doneButton: {
    flex: 1,
    minHeight: 56,
    backgroundColor: Colors.sage,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  doneButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    letterSpacing: 0.2,
  },
});

export default MorningClosingScreen;
