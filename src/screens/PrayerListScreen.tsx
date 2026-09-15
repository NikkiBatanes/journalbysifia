import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import {
  useAllPrayerData,
  useUpdatePrayer,
  useMarkPrayerRequestPrayed,
} from '../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../services/api/prayerApi';
import { queryKeys } from '../services/queryKeys';
import { getLatestPrayerDraft, PrayerDraft } from '../storage/prayerDraftStorage';

type PrayerTab = 'active' | 'answered' | 'people';

const TABS: { key: PrayerTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'answered', label: 'Answered' },
  { key: 'people', label: 'People' },
];

const PRAYER_ACTIONS = [
  {
    key: 'acts',
    label: 'CAST',
    description: 'Pray with a guided rhythm',
    icon: 'layers-outline',
  },
  {
    key: 'open',
    label: 'Open',
    description: 'Bring God what is on your heart',
    icon: 'create-outline',
  },
  {
    key: 'pray-for-someone',
    label: 'For Someone',
    description: 'Write a prayer for someone',
    icon: 'heart-outline',
  },
  {
    key: 'prayer-request',
    label: 'Request',
    description: 'Remember what someone asked',
    icon: 'chatbubble-ellipses-outline',
  },
] as const;

type PrayerHomeEntry = PrayerApiEntry & {
  groupedEntries?: PrayerApiEntry[];
};

const CAST_ORDER = ['confession', 'adoration', 'supplication', 'thanksgiving'];

const groupPrayerEntries = (prayers: PrayerApiEntry[]): PrayerHomeEntry[] => {
  const sessions = new Map<string, PrayerApiEntry[]>();
  const ungrouped: PrayerHomeEntry[] = [];

  prayers.forEach((prayer) => {
    const sessionId = prayer.metadata?.prayer_session_id;
    if (prayer.metadata?.prayer_style === 'cast' && sessionId) {
      sessions.set(sessionId, [...(sessions.get(sessionId) || []), prayer]);
    } else {
      ungrouped.push(prayer);
    }
  });

  sessions.forEach((entries, sessionId) => {
    const sorted = [...entries].sort(
      (a, b) => CAST_ORDER.indexOf(a.journal_category || '') - CAST_ORDER.indexOf(b.journal_category || '')
    );
    const supplication = sorted.find((entry) => entry.journal_category === 'supplication');
    const representative = supplication || sorted[0];
    ungrouped.push({
      ...representative,
      id: `cast-${sessionId}`,
      content: sorted
        .map((entry) => `${entry.journal_category?.toUpperCase()}\n${entry.content}`)
        .join('\n\n'),
      created_at: sorted[0]?.created_at || representative.created_at,
      metadata: { ...representative.metadata, prayer_style: 'cast', prayer_session_id: sessionId },
      groupedEntries: sorted,
    });
  });

  return ungrouped.sort((a, b) => b.created_at.localeCompare(a.created_at));
};

const formatStarted = (dateString?: string | null) => {
  if (!dateString) { return ''; }
  try {
    return format(new Date(dateString), 'MMM d').toUpperCase();
  } catch {
    return '';
  }
};

const PrayerCard = ({
  prayer,
  onPrayAgain,
  onMarkAnswered,
  onAddPrayer,
}: {
  prayer: PrayerHomeEntry;
  onPrayAgain: (prayer: PrayerHomeEntry) => void;
  onMarkAnswered: (prayer: PrayerHomeEntry) => void;
  onAddPrayer: (prayer: PrayerHomeEntry) => void;
}) => {
  const isAnswered = prayer.status === 'answered' || prayer.is_answered;
  const isPrayerRequest = prayer.is_prayer_request === true;
  const isCast = prayer.metadata?.prayer_style === 'cast';
  const isOpen = prayer.metadata?.prayer_style === 'open' || prayer.journal_category === 'personal_prayer';
  const typeLabel = isCast
    ? 'CAST PRAYER'
    : isOpen
      ? 'OPEN PRAYER'
      : isPrayerRequest
        ? 'PRAYER REQUEST'
        : 'FOR SOMEONE';
  const title = isCast ? 'CAST Prayer' : isOpen ? 'Open Prayer' : prayer.person_name || 'Prayer';
  const body = prayer.content || prayer.notes || '';
  const prayerCount = prayer.prayer_count ?? (prayer.prayed ? 1 : 0);

  return (
    <View style={styles.card}>
      <ThemedText style={styles.cardMeta}>
        {typeLabel} · {isPrayerRequest ? 'REQUESTED ' : 'STARTED '}{formatStarted(prayer.created_at)}
      </ThemedText>
      <ThemedText weight="semiBold" style={styles.cardTitle}>{title}</ThemedText>
      {body && (
        <ThemedText style={styles.cardBody} numberOfLines={isCast ? 5 : 3}>{body}</ThemedText>
      )}
      {prayerCount > 0 && (
        <ThemedText style={styles.prayedMeta}>
          Prayed {prayerCount} {prayerCount === 1 ? 'time' : 'times'}
        </ThemedText>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, isAnswered && styles.actionButtonDisabled]}
          onPress={() => onPrayAgain(prayer)}
          disabled={isAnswered}
          activeOpacity={0.7}
        >
          <ThemedText weight="medium" style={[styles.actionButtonText, isAnswered && styles.actionButtonTextDisabled]}>
            Pray again
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onAddPrayer(prayer)}
          activeOpacity={0.7}
        >
          <ThemedText weight="medium" style={styles.actionButtonText}>Add a prayer</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, isAnswered && styles.actionButtonActive]}
          onPress={() => onMarkAnswered(prayer)}
          activeOpacity={0.7}
        >
          <ThemedText weight="medium" style={[styles.actionButtonText, isAnswered && styles.actionButtonTextActive]}>
            {isAnswered ? 'Answered' : 'Mark Answered'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const PrayerListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PrayerTab>('active');
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [latestDraft, setLatestDraft] = useState<PrayerDraft | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    getLatestPrayerDraft().then((draft) => {
      if (active) {setLatestDraft(draft);}
    });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subscription = DeviceEventEmitter.addListener('prayerSaved', () => {
      setShowSavedConfirmation(true);
      timeout = setTimeout(() => setShowSavedConfirmation(false), 2200);
    });

    return () => {
      subscription.remove();
      if (timeout) {clearTimeout(timeout);}
    };
  }, []);

  const { data: prayers = [], isLoading } = useAllPrayerData(user?.id || '');
  const updatePrayer = useUpdatePrayer();
  const markPrayed = useMarkPrayerRequestPrayed();
  const groupedPrayers = useMemo(() => groupPrayerEntries(prayers), [prayers]);

  const filteredPrayers = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return groupedPrayers.filter((p) => p.status !== 'answered' && !p.is_answered);
      case 'answered':
        return groupedPrayers.filter((p) => p.status === 'answered' || p.is_answered);
      case 'people':
      default:
        return groupedPrayers.filter((p) => p.prayer_type === 'people');
    }
  }, [activeTab, groupedPrayers]);

  const handlePrayAgain = async (prayer: PrayerHomeEntry) => {
    try {
      triggerLightHaptic();
      const target = prayer.groupedEntries?.find((entry) => entry.journal_category === 'supplication')
        || prayer.groupedEntries?.[0]
        || prayer;
      await markPrayed.mutateAsync({
        id: target.id,
        isPrayed: true,
        _userId: user?.id || '',
        _dateStr: prayer.selected_date,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(user?.id || '') });
      triggerSuccessHaptic();
    } catch (err) {
      Alert.alert('Error', 'Could not mark prayer as prayed.');
    }
  };

  const handleMarkAnswered = async (prayer: PrayerHomeEntry) => {
    try {
      triggerLightHaptic();
      const target = prayer.groupedEntries?.find((entry) => entry.journal_category === 'supplication')
        || prayer.groupedEntries?.[0]
        || prayer;
      if (prayer.status === 'answered' || prayer.is_answered) {
        await updatePrayer.mutateAsync({
          id: target.id,
          updates: { status: 'pending', answered_date: null },
          _userId: user?.id || '',
          _dateStr: prayer.selected_date,
        });
      } else {
        await updatePrayer.mutateAsync({
          id: target.id,
          updates: { status: 'answered', answered_date: new Date().toISOString() },
          _userId: user?.id || '',
          _dateStr: prayer.selected_date,
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(user?.id || '') });
      triggerSuccessHaptic();
    } catch (err) {
      Alert.alert('Error', 'Could not update prayer status.');
    }
  };

  const handleContinueDraft = () => {
    if (!latestDraft) {return;}
    triggerLightHaptic();

    if (latestDraft.type === 'acts' || latestDraft.type === 'open') {
      navigation.navigate('PrayerJournalWalkthrough', {
        selectedDate: latestDraft.selectedDate,
        initialPrayerType: latestDraft.type,
        showDescription: false,
      });
      return;
    }

    if (latestDraft.type === 'pray-for-someone' || latestDraft.type === 'prayer-request') {
      navigation.navigate('PrayersForPeopleWalkthrough', {
        selectedDate: latestDraft.selectedDate,
        initialPrayerType: latestDraft.type,
      });
      return;
    }

    if (latestDraft.type === 'prayer-editor' && latestDraft.data.prayerRequest) {
      navigation.navigate('PrayerEditor', { prayerRequest: latestDraft.data.prayerRequest });
    }
  };

  const handleAddPrayer = (prayer: PrayerHomeEntry) => {
    triggerLightHaptic();
    const selectedDate = new Date().toISOString();

    if (prayer.is_prayer_request) {
      navigation.navigate('PrayerEditor', {
        prayerRequest: {
          person_name: prayer.person_name || '',
          content: prayer.content,
          id: prayer.id,
          user_id: prayer.user_id || user?.id || '',
          selected_date: prayer.selected_date,
        },
      });
      return;
    }

    if (prayer.prayer_type === 'people') {
      navigation.navigate('PrayersForPeopleWalkthrough', {
        selectedDate,
        initialPrayerType: 'pray-for-someone',
        initialPersonName: prayer.person_name,
      });
      return;
    }

    navigation.navigate('PrayerJournalWalkthrough', {
      selectedDate,
      initialPrayerType: prayer.metadata?.prayer_style === 'cast' ? 'acts' : 'open',
      showDescription: false,
    });
  };

  const handlePrayerAction = (type: typeof PRAYER_ACTIONS[number]['key']) => {
    triggerLightHaptic();
    const selectedDate = new Date().toISOString();

    if (type === 'acts' || type === 'open') {
      navigation.navigate('PrayerJournalWalkthrough', {
        selectedDate,
        initialPrayerType: type,
        showDescription: true,
      });
      return;
    }

    navigation.navigate('PrayersForPeopleWalkthrough', {
      selectedDate,
      initialPrayerType: type,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>PRAYER</ThemedText>
        <ThemedText style={styles.title}>Return to what you’re praying about.</ThemedText>
      </View>

      {showSavedConfirmation && (
        <View style={styles.savedConfirmation}>
          <Ionicons name="checkmark-circle" size={17} color={Colors.growthGreen} />
          <ThemedText weight="medium" style={styles.savedConfirmationText}>Prayer saved</ThemedText>
        </View>
      )}

      {latestDraft && (
        <TouchableOpacity style={styles.draftCard} onPress={handleContinueDraft} activeOpacity={0.75}>
          <View style={styles.draftIcon}>
            <Ionicons name="create-outline" size={18} color={Colors.alertCoral} />
          </View>
          <View style={styles.draftContent}>
            <ThemedText weight="semiBold" style={styles.draftEyebrow}>CONTINUE WRITING</ThemedText>
            <ThemedText weight="medium" style={styles.draftTitle}>
              {latestDraft.type === 'acts'
                ? 'CAST Prayer'
                : latestDraft.type === 'open'
                  ? 'Open Prayer'
                  : latestDraft.type === 'pray-for-someone'
                    ? 'Prayer for Someone'
                    : latestDraft.type === 'prayer-editor'
                      ? `Prayer for ${latestDraft.data.prayerRequest?.person_name || 'Someone'}`
                      : 'Prayer Request'}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.sage} />
        </TouchableOpacity>
      )}

      <View style={styles.actionSection}>
        <ThemedText weight="semiBold" style={styles.sectionLabel}>PRAYER</ThemedText>
        <View style={styles.actionGrid}>
          {PRAYER_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.prayerAction}
              onPress={() => handlePrayerAction(action.key)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon} size={19} color={Colors.alertCoral} />
              </View>
              <ThemedText weight="semiBold" style={styles.actionLabel}>{action.label}</ThemedText>
              <ThemedText style={styles.actionDescription}>{action.description}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => {
                triggerLightHaptic();
                setActiveTab(tab.key);
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight={isActive ? 'semiBold' : 'regular'} style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.sage} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredPrayers.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyTitle}>No prayers yet.</ThemedText>
              <ThemedText style={styles.emptySubtitle}>Tap the button below to add one.</ThemedText>
            </View>
          ) : (
            filteredPrayers.map((prayer) => (
              <PrayerCard
                key={prayer.id}
                prayer={prayer}
                onPrayAgain={handlePrayAgain}
                onMarkAnswered={handleMarkAnswered}
                onAddPrayer={handleAddPrayer}
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    paddingHorizontal: 18,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    color: Colors.textGray,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  savedConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: -12,
    marginBottom: 16,
  },
  savedConfirmationText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
  },
  draftIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216, 126, 104, 0.1)',
  },
  draftContent: {
    flex: 1,
  },
  draftEyebrow: {
    color: Colors.textGray,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  draftTitle: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  actionSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  prayerAction: {
    width: '48.5%',
    minHeight: 124,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216, 126, 104, 0.1)',
    marginBottom: 10,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 19,
    marginBottom: 3,
  },
  actionDescription: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  tabText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  tabTextActive: {
    color: Colors.hopeWhite,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  empty: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textGray,
    fontSize: 14,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },
  cardMeta: {
    color: Colors.textGray,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardBody: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  prayedMeta: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: 'transparent',
  },
  actionButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: Colors.sage,
    fontSize: 13,
    lineHeight: 16,
  },
  actionButtonTextActive: {
    color: Colors.hopeWhite,
  },
  actionButtonTextDisabled: {
    color: Colors.textGray,
  },
});

export default PrayerListScreen;
