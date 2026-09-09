import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check } from 'lucide-react-native';

import ThemedText from '../../components/common/ThemedText';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useMorningStatusBar } from '../../hooks/useMorningStatusBar';
import { toLocalDateString } from '../../utils/date';
import { useCreateJournalEntry } from '../../services/hooks/useJournalData';

interface SummaryRowProps {
  label: string;
  value: string;
}

const SummaryRow = ({ label, value }: SummaryRowProps) => (
  <View style={styles.summaryRow}>
    <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
    <ThemedText weight="medium" style={styles.summaryValue}>{value}</ThemedText>
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
  useMorningStatusBar();

  const feeling: string | undefined = params.feeling;
  const underneath: string | undefined = params.underneath;
  const focus: string | undefined = params.focus;
  const mainPriority: string | undefined =
    params.mainPriority ||
    params.priorities?.[0]?.text ||
    params.personalText;
  const topTodos: string[] | undefined =
    params.topTodos ||
    (params.priorities ? params.priorities.slice(1, 4).map((p: any) => p.text ?? p) : undefined);
  const carry: string | undefined = params.carry;
  const checkedInAt = useMemo(() => new Date().toISOString(), []);
  const date = params.selectedDate ? new Date(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(date);

  const onDone = async () => {
    triggerLightHaptic();

    if (user) {
      try {
        const content = JSON.stringify({
          feeling,
          underneath,
          focus,
          focusCategory: params.focusCategory,
          customFocus: params.customFocus,
          personalText: params.personalText,
          priorities: params.priorities,
          topTodos,
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
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={28} color={Colors.hopeWhite} />
        </View>
        <ThemedText style={styles.title}>{isStandaloneCheckIn ? 'Check-in saved.' : "You're ready for today."}</ThemedText>
        <ThemedText style={styles.subtitle}>
          {isStandaloneCheckIn ? 'You made space to notice what is happening within.' : 'Your morning rhythm is saved.'}
        </ThemedText>

        <View style={styles.summaryCard}>
          <SummaryRow label="Feeling" value={feeling ?? '—'} />
          <SummaryRow label="Checked in" value={params.checkedInAt ?? 'Just now'} />
          {isStandaloneCheckIn ? (
            <View style={styles.summaryRowLast}>
              <ThemedText style={styles.summaryLabel}>What’s underneath</ThemedText>
              <ThemedText weight="medium" style={underneath ? styles.summaryValue : styles.summaryValueMuted}>
                {underneath || 'Nothing added'}
              </ThemedText>
            </View>
          ) : (
            <>
              <SummaryRow label="Focus" value={focus ?? 'Open'} />
              <SummaryRow label="Main priority" value={mainPriority ?? 'No main priority added'} />
              <View style={styles.summaryRowLast}>
                <ThemedText style={styles.summaryLabel}>Top 3</ThemedText>
                {topTodos && topTodos.length > 0 ? (
                  <View style={styles.todoList}>
                    {topTodos.slice(0, 3).map((todo, index) => (
                      <ThemedText key={`${todo}-${index}`} weight="medium" style={styles.summaryValue}>
                        {index + 1}. {todo}
                      </ThemedText>
                    ))}
                  </View>
                ) : (
                  <ThemedText weight="medium" style={styles.summaryValueMuted}>No to-dos added</ThemedText>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onDone}
        >
          <Check size={16} color={Colors.hopeWhite} style={styles.doneButtonIcon} />
          <ThemedText weight="medium" style={styles.doneButtonText}>Done</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    marginBottom: 16,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  summaryRowLast: {
    paddingVertical: 14,
    gap: 8,
  },
  summaryLabel: {
    color: Colors.textGray,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
    flexShrink: 1,
  },
  summaryValueMuted: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
  },
  todoList: {
    gap: 4,
    alignItems: 'flex-start',
  },
  footer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  doneButton: {
    backgroundColor: Colors.sage,
    borderWidth: 1,
    borderColor: Colors.sage,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  doneButtonIcon: {
    marginRight: 8,
  },
  doneButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
});

export default MorningClosingScreen;
