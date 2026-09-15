import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  useDeletePrayer,
  useCreatePrayer,
  useAllPrayerData,
  useUpdatePrayer,
  useMarkPrayerRequestPrayed,
} from '../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../services/api/prayerApi';
import { queryKeys } from '../services/queryKeys';
import { openPrayerFlow } from '../navigation/openPrayerFlow';
import PrayerResponseSheet from '../components/prayer/PrayerResponseSheet';
import PrayerTrackingModal from '../components/prayer/PrayerTrackingModal';
import { isTrackedPrayer, trackingStatus, prayerNeeds, answerPrayer, type PrayerUpdate } from '../utils/prayerTracking';
import { getLatestPrayerDraft, PrayerDraft } from '../storage/prayerDraftStorage';

type PrayerTab = 'active' | 'requests' | 'answered' | 'all';

const TABS: { key: PrayerTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Still praying' },
  { key: 'requests', label: 'Requests' },
  { key: 'answered', label: 'Answered' },
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
    // siFia keeps fulfilled requests in storage but displays their saved prayer instead.
    if (prayer.is_prayer_request === true && prayer.prayed === true) return;
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
        || (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
        || b.created_at.localeCompare(a.created_at)
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
  onAddPrayer,
  onManage,
  onEdit,
  onManageAnswers,
  onAnswered,
  answering,
}: {
  prayer: PrayerHomeEntry;
  onPrayAgain: (prayer: PrayerHomeEntry) => void;
  onAddPrayer: (prayer: PrayerHomeEntry) => void;
  onManage: (prayer: PrayerHomeEntry) => void;
  onEdit: (prayer: PrayerHomeEntry) => void;
  onManageAnswers: (prayer: PrayerHomeEntry) => void;
  onAnswered: (prayer: PrayerHomeEntry, needId?: string) => void;
  answering: boolean;
}) => {
  const state = trackingStatus(prayer);
  const tracked = isTrackedPrayer(prayer);
  const isAnswered = state === 'answered';
  const isPrayerRequest = prayer.is_prayer_request === true;
  const isCast = prayer.metadata?.prayer_style === 'cast';
  const isOpen = prayer.metadata?.prayer_style === 'open' || prayer.journal_category === 'personal_prayer';
  const typeLabel = prayer.metadata?.prayer_need ? 'PRAYER NEED' : isCast
    ? 'CAST PRAYER'
    : isOpen
      ? 'OPEN PRAYER'
      : isPrayerRequest
        ? 'PRAYER REQUEST'
        : 'PRAYED FOR';
  const title = prayer.metadata?.prayer_need ? prayer.person_name || 'My prayer need' : isCast ? 'CAST Prayer' : isOpen ? 'Open Prayer' : prayer.person_name || 'Prayer';
  const [showHistory, setShowHistory] = useState(false);
  const history: PrayerUpdate[] = Array.isArray(prayer.metadata?.prayer_updates) ? [...(prayer.metadata?.prayer_updates || [])].reverse() : [];
  const latestUpdate = history.find(update => !update.status);
  const body = prayer.content || prayer.notes || '';
  const seenCastSections = new Set<string>();
  const castSections = isCast ? (prayer.groupedEntries || [prayer]).map(entry => {
    const category = entry.journal_category || '';
    const text = entry.content || entry.notes || '';
    // Older entries may already include their own heading. Display it once as a label.
    const content = CAST_ORDER.includes(category)
      ? text.replace(new RegExp('^(?:\\s*' + category + '[ \\t]*:?\\s*(?:\\r?\\n|$))+', 'i'), '').trim()
      : text.trim();
    return { id: entry.id, label: CAST_ORDER.includes(category) ? category.toUpperCase() : '', content };
  }).filter(section => {
    if (!section.content) return false;
    const key = section.label || section.id;
    if (seenCastSections.has(key)) return false;
    seenCastSections.add(key);
    return true;
  }) : [];
  const prayerCount = prayer.prayer_count ?? (prayer.prayed ? 1 : 0);

  const needsPrayer = isPrayerRequest && !prayer.prayed && state === 'pending';
  const requestContext = !isPrayerRequest
    ? prayer.metadata?.prayer_request_display || prayer.metadata?.original_request_content
    : undefined;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => onEdit(prayer)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Edit ${title}`}>
        <View style={styles.prayerTypeRow}>
          {isOpen ? <Ionicons name="chatbubble-outline" size={14} color={Colors.sage} /> : <Ionicons name={isPrayerRequest ? 'mail-unread-outline' : isCast ? 'layers-outline' : 'heart-outline'} size={14} color={Colors.sage} />}
          <ThemedText weight="semiBold" style={styles.cardMeta}>{typeLabel}</ThemedText>
          {isAnswered && <Ionicons name="checkmark-circle" size={14} color={Colors.sage} />}
          <ThemedText style={styles.cardDate}>{formatStarted(prayer.created_at)}</ThemedText>
        </View>
        <ThemedText weight="bold" style={styles.cardTitle}>{title}</ThemedText>
        {isCast ? castSections.map(section => <View key={section.id} style={styles.castSection}>
          {!!section.label && <ThemedText weight="semiBold" style={styles.castLabel}>{section.label}</ThemedText>}
          <ThemedText style={[styles.cardBody, styles.castBody]} numberOfLines={2}>{section.content}</ThemedText>
        </View>) : !!body && !(prayer.metadata?.prayer_need && prayerNeeds(prayer).length > 0) && <ThemedText style={styles.cardBody} numberOfLines={3}>{body}</ThemedText>}
        {!!requestContext && (
          <View style={styles.requestContext}>
            <Ionicons name="mail-unread-outline" size={13} color={Colors.sage} />
            <ThemedText style={styles.requestContextText} numberOfLines={3}>Prayer request: {requestContext}</ThemedText>
          </View>
        )}
      </TouchableOpacity>
      {latestUpdate && !showHistory && <View style={styles.updatePreview}>
        <ThemedText weight="semiBold" style={styles.updateLabel}>{latestUpdate.kind === 'answered' ? 'GOD ANSWERED' : latestUpdate.kind === 'situation-changed' ? 'SITUATION CHANGED' : 'LATEST UPDATE'} · {formatStarted(latestUpdate.date)}</ThemedText>
        <ThemedText style={styles.updateText} numberOfLines={3}>{latestUpdate.text}</ThemedText>
      </View>}
      {showHistory && history.map((update, index) => <View key={update.id || `${update.date}-${index}`} style={styles.updatePreview}>
        <ThemedText weight="semiBold" style={styles.updateLabel}>{formatStarted(update.date)}{update.needId ? ` · ${prayerNeeds(prayer).find(need => need.id === update.needId)?.text || 'Prayer need'}` : ''}</ThemedText>
        <ThemedText style={styles.updateText}>{update.text}</ThemedText>
      </View>)}
      {history.length > 0 && <TouchableOpacity style={styles.historyToggle} onPress={() => { triggerLightHaptic(); setShowHistory(!showHistory); }} accessibilityRole="button" accessibilityState={{ expanded: showHistory }}>
        <ThemedText weight="semiBold" style={styles.actionButtonText}>{showHistory ? 'Hide history' : `View history (${history.length})`}</ThemedText>
        <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.sage} />
      </TouchableOpacity>}
      {tracked && prayerNeeds(prayer).map(need => <View key={need.id} style={styles.castSection}><ThemedText style={styles.cardBody}>{need.text}</ThemedText>{prayerNeeds(prayer).length > 1 && <ThemedText style={styles.cardMeta}>{need.status === 'pending' ? 'Still praying' : need.status === 'answered' ? 'Answered' : 'Closed'}</ThemedText>}{prayerNeeds(prayer).length > 1 && <TouchableOpacity disabled={answering} style={[styles.actionButton, { alignSelf: 'flex-start', marginVertical: 8 }]} onPress={() => onAnswered(prayer, need.id)}><Ionicons name="checkmark-circle-outline" size={14} color={Colors.sage} /><ThemedText weight="semiBold" style={styles.actionButtonText}>{need.status === 'answered' ? 'Answered' : 'Mark answered'}</ThemedText></TouchableOpacity>}</View>)}
      {needsPrayer ? (
        <View style={styles.requestActionContainer}>
          <TouchableOpacity style={styles.requestPrayButton} onPress={() => onAddPrayer(prayer)} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.sage} />
            <ThemedText weight="medium" style={styles.requestPrayText}>Pray for {prayer.person_name || 'them'} now</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardActions}>
          {!isAnswered && <TouchableOpacity style={[styles.actionButton, styles.cardActionButton]} onPress={() => onPrayAgain(prayer)} activeOpacity={0.7}>
            <Ionicons name="heart-outline" size={14} color={Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.actionButtonText, styles.cardActionText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Pray again</ThemedText>
          </TouchableOpacity>}
          <TouchableOpacity style={[styles.actionButton, styles.cardActionButton]} onPress={() => onManage(prayer)} activeOpacity={0.7}>
            <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.actionButtonText, styles.cardActionText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tracked ? 'Add update' : 'Keep praying'}</ThemedText>
          </TouchableOpacity>
          {tracked && !needsPrayer &&  <TouchableOpacity disabled={answering} style={[styles.actionButton, styles.cardActionButton, { flexGrow: 1.35 }, isAnswered && styles.actionButtonActive]} onPress={() => prayerNeeds(prayer).length > 1 ? onManageAnswers(prayer) : onAnswered(prayer, prayerNeeds(prayer)[0]?.id)} activeOpacity={0.7}>
            <Ionicons name={isAnswered ? 'sparkles-outline' : 'checkmark-circle-outline'} size={14} color={isAnswered ? Colors.hopeWhite : Colors.sage} />
            <ThemedText weight="semiBold" style={[styles.actionButtonText, styles.cardActionText, isAnswered && styles.actionButtonTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{prayerNeeds(prayer).length > 1 ? 'Manage answers' : isAnswered ? 'Answered' : 'Mark answered'}</ThemedText>
          </TouchableOpacity>}
        </View>
      )}
      {!needsPrayer && (
        <ThemedText style={styles.prayedMeta}>
          {!tracked ? 'Saved prayer · Not tracked' : isAnswered ? 'Answered' : state === 'closed' ? 'Closed' : 'Still praying'}{prayerCount > 0 ? ` · Prayed ${prayerCount} ${prayerCount === 1 ? 'time' : 'times'}` : ''}{prayer.answered_date && isAnswered ? ` · ${formatStarted(prayer.answered_date)}` : ''}
        </ThemedText>
      )}
    </View>
  );
};

const PrayerListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [trackingMode, setTrackingMode] = useState<'update' | 'details'>('update');
  const [trackingPrayer, setTrackingPrayer] = useState<PrayerHomeEntry | null>(null);
  const [creatingNeed, setCreatingNeed] = useState(false);
  const [respondingTo, setRespondingTo] = useState<PrayerHomeEntry | null>(null);
  const answerInFlight = useRef(false);
  const [answering, setAnswering] = useState(false);
  const createPrayer = useCreatePrayer();
  const deletePrayer = useDeletePrayer();
  const [activeTab, setActiveTab] = useState<PrayerTab>('all');
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

  const pendingRequests = useMemo(() => groupedPrayers.filter(p => p.is_prayer_request === true && p.prayed !== true && trackingStatus(p) === 'pending'), [groupedPrayers]);

  const filteredPrayers = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return groupedPrayers.filter(p => isTrackedPrayer(p) && trackingStatus(p) === 'pending' && !(p.is_prayer_request && !p.prayed));
      case 'requests':
        return pendingRequests;
      case 'answered':
        return groupedPrayers.filter(p => trackingStatus(p) === 'answered');
      case 'all':
      default:
        return groupedPrayers;
    }
  }, [activeTab, groupedPrayers, pendingRequests]);

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

  const handleAnswered = async (prayer: PrayerHomeEntry, needId?: string) => {
    if (answerInFlight.current) return;
    triggerLightHaptic();
    answerInFlight.current = true;
    setAnswering(true);
    try {
      const target = prayer.groupedEntries?.find(p => p.journal_category === 'supplication') || prayer.groupedEntries?.[0] || prayer;
      const updates = answerPrayer(target, needId);
      await updatePrayer.mutateAsync({ id: target.id, updates, _userId: user?.id || '', _dateStr: target.selected_date });
      const requestId = target.is_prayer_request ? target.id : target.metadata?.original_request_id;
      const related = requestId ? prayers.filter(p => p.id !== target.id && (p.id === requestId || p.metadata?.original_request_id === requestId)) : [];
      for (const linked of related) await updatePrayer.mutateAsync({ id: linked.id, updates: { ...updates, metadata: { ...linked.metadata, track_answered: true, tracking_status: updates.metadata.tracking_status, prayer_needs: updates.metadata.prayer_needs, prayer_updates: updates.metadata.prayer_updates } }, _userId: user?.id || '', _dateStr: linked.selected_date });
      await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(user?.id || '') });
      triggerSuccessHaptic();
    } catch { Alert.alert('Could not update prayer', 'Please try again.'); }
    finally { answerInFlight.current = false; setAnswering(false); }
  };

  const saveTracking = async (data: Parameters<React.ComponentProps<typeof PrayerTrackingModal>['onSave']>[0]) => {
    if (trackingPrayer) {
      const target = trackingPrayer.groupedEntries?.find(p => p.journal_category === 'supplication') || trackingPrayer.groupedEntries?.[0] || trackingPrayer;
      const { content, ...trackingUpdates } = data;
      const updates = { ...trackingUpdates, content };
      await updatePrayer.mutateAsync({ id: target.id, updates, _userId: user?.id || '', _dateStr: target.selected_date });
      const requestId = target.is_prayer_request ? target.id : target.metadata?.original_request_id;
      const related = requestId ? prayers.filter(p => p.id !== target.id && (p.id === requestId || p.metadata?.original_request_id === requestId)) : [];
      for (const linked of related) await updatePrayer.mutateAsync({ id: linked.id, updates: { status: data.status, answered_date: data.answered_date, metadata: { ...linked.metadata, ...Object.fromEntries(['track_answered', 'tracking_status', 'prayer_needs', 'prayer_updates'].filter(key => data.metadata[key] !== undefined).map(key => [key, data.metadata[key]])) } }, _userId: user?.id || '', _dateStr: linked.selected_date });
    } else {
      await createPrayer.mutateAsync({ ...data, user_id: user?.id || 'local', selected_date: format(new Date(), 'yyyy-MM-dd'), prayer_type: 'journal', journal_category: 'supplication', prayed: false, prayer_count: 0 });
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(user?.id || '') });
    triggerSuccessHaptic();
  };

  const deleteTrackingPrayer = async () => {
    if (!trackingPrayer) return;
    for (const entry of trackingPrayer.groupedEntries || [trackingPrayer]) await deletePrayer.mutateAsync({ id: entry.id, _userId: user?.id || '', _dateStr: entry.selected_date });
    await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(user?.id || '') });
  };

  const navigateToPrayerScreen = useCallback((screen: 'PrayerJournalWalkthrough' | 'PrayersForPeopleWalkthrough' | 'PrayerEditor', params: Record<string, any>) => {
    openPrayerFlow(navigation, screen, params);
  }, [navigation]);

  const handleContinueDraft = () => {
    if (!latestDraft) {return;}
    triggerLightHaptic();

    if (latestDraft.type === 'acts' || latestDraft.type === 'open') {
      navigateToPrayerScreen('PrayerJournalWalkthrough', {
        selectedDate: latestDraft.selectedDate,
        initialPrayerType: latestDraft.type,
        showDescription: false,
      });
      return;
    }

    if (latestDraft.type === 'pray-for-someone' || latestDraft.type === 'prayer-request') {
      navigateToPrayerScreen('PrayersForPeopleWalkthrough', {
        selectedDate: latestDraft.selectedDate,
        initialPrayerType: latestDraft.type,
      });
      return;
    }

    if (latestDraft.type === 'prayer-editor' && latestDraft.data.prayerRequest) {
      navigateToPrayerScreen('PrayerEditor', { prayerRequest: latestDraft.data.prayerRequest });
    }
  };

  const handleAddPrayer = (prayer: PrayerHomeEntry) => {
    triggerLightHaptic();
    const selectedDate = new Date().toISOString();

    if (prayer.is_prayer_request) {
      setRespondingTo(prayer);
      return;
    }

    if (prayer.prayer_type === 'people') {
      navigateToPrayerScreen('PrayersForPeopleWalkthrough', {
        selectedDate,
        initialPrayerType: 'pray-for-someone',
        initialPersonName: prayer.person_name,
      });
      return;
    }

    navigateToPrayerScreen('PrayerJournalWalkthrough', {
      selectedDate,
      initialPrayerType: prayer.metadata?.prayer_style === 'cast' ? 'acts' : 'open',
      showDescription: false,
    });
  };

  const handleEditPrayer = (prayer: PrayerHomeEntry) => {
    triggerLightHaptic();
    if (prayer.metadata?.prayer_need) {
      setTrackingMode('details');
      setTrackingPrayer(prayer);
      return;
    }
    const target = prayer.groupedEntries?.find(p => p.journal_category === 'supplication') || prayer.groupedEntries?.[0] || prayer;
    if (prayer.prayer_type === 'people' || prayer.is_prayer_request) {
      navigateToPrayerScreen('PrayersForPeopleWalkthrough', { selectedDate: target.selected_date, editingPrayerId: target.id, initialPrayerType: prayer.is_prayer_request ? 'prayer-request' : 'pray-for-someone', initialPersonName: prayer.person_name, ...(prayer.is_prayer_request ? { initialPrayerRequest: prayer.content } : { initialPrayerText: prayer.content }) });
    } else {
      navigateToPrayerScreen('PrayerJournalWalkthrough', { selectedDate: target.selected_date, editingPrayerId: target.id, initialPrayerType: prayer.metadata?.prayer_style === 'cast' || prayer.groupedEntries ? 'acts' : 'open', showDescription: false });
    }
  };

  const handlePrayerAction = (type: typeof PRAYER_ACTIONS[number]['key']) => {
    triggerLightHaptic();
    const selectedDate = new Date().toISOString();

    if (type === 'acts' || type === 'open') {
      navigateToPrayerScreen('PrayerJournalWalkthrough', {
        selectedDate,
        initialPrayerType: type,
        showDescription: true,
      });
      return;
    }

    navigateToPrayerScreen('PrayersForPeopleWalkthrough', {
      selectedDate,
      initialPrayerType: type,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>PRAYER</ThemedText>
        <ThemedText weight="bold" style={styles.title}>Return to what you’re praying about.</ThemedText>
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
            <Ionicons name="create-outline" size={18} color={Colors.sage} />
          </View>
          <View style={styles.draftContent}>
            <ThemedText weight="semiBold" style={styles.draftEyebrow}>CONTINUE WRITING</ThemedText>
            <ThemedText weight="bold" style={styles.draftTitle}>
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
        <ThemedText weight="bold" style={styles.sectionLabel}>MAKE ROOM FOR PRAYER</ThemedText>
        <View style={styles.actionGrid}>
          {PRAYER_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.prayerAction}
              onPress={() => handlePrayerAction(action.key)}
              activeOpacity={0.75}
            >
              {action.key === 'open' ? <Ionicons name="chatbubble-outline" size={16} color={Colors.sage} /> : <Ionicons name={action.icon} size={16} color={Colors.sage} />}
              <ThemedText weight="semiBold" style={styles.actionLabel}>{action.label}</ThemedText>

            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.prayerAction} onPress={() => { triggerLightHaptic(); setCreatingNeed(true); }} activeOpacity={0.75}>
            <Ionicons name="add-circle-outline" size={16} color={Colors.sage} />
            <ThemedText weight="semiBold" style={styles.actionLabel}>Prayer need</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
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
              <ThemedText weight="semiBold" style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}{tab.key === 'requests' && pendingRequests.length > 0 ? ` · ${pendingRequests.length}` : ''}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.sage} />
        </View>
      ) : (
        <View>
          {filteredPrayers.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText weight="bold" style={styles.emptyTitle}>{activeTab === 'requests' ? 'No requests waiting.' : activeTab === 'answered' ? 'No answered prayers yet.' : 'No prayers yet.'}</ThemedText>
              <ThemedText style={styles.emptySubtitle}>{activeTab === 'requests' ? 'New requests will appear here until you pray for them.' : 'Choose a prayer above to begin.'}</ThemedText>
            </View>
          ) : (
            filteredPrayers.map((prayer) => (
              <PrayerCard
                key={prayer.id}
                prayer={prayer}
                onPrayAgain={handlePrayAgain}
                onEdit={handleEditPrayer}
                onManageAnswers={p => { triggerLightHaptic(); setTrackingMode('details'); setTrackingPrayer(p); }}
                onManage={p => { triggerLightHaptic(); setTrackingMode(isTrackedPrayer(p) ? 'update' : 'details'); setTrackingPrayer(p); }}
                onAnswered={handleAnswered}
                answering={answering}
                onAddPrayer={handleAddPrayer}
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </View>
      )}

      </ScrollView>
      {respondingTo && <PrayerResponseSheet request={respondingTo} onClose={() => setRespondingTo(null)} onSaved={async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(user?.id || '') }); setRespondingTo(null); }} />}
      {(creatingNeed || trackingPrayer) && <PrayerTrackingModal onDelete={trackingPrayer ? deleteTrackingPrayer : undefined} mode={trackingPrayer ? trackingMode : 'details'} onShowDetails={() => setTrackingMode('details')} prayer={trackingPrayer ? (trackingPrayer.groupedEntries?.find(p => p.journal_category === 'supplication') || trackingPrayer.groupedEntries?.[0] || trackingPrayer) : undefined} onClose={() => { setCreatingNeed(false); setTrackingPrayer(null); }} onSave={saveTracking} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  content: {
    paddingHorizontal: 18,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    color: Colors.sageMuted,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 31,
    lineHeight: 39,
    letterSpacing: -0.5,
    fontWeight: '900',
    marginTop: 8,
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
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  draftIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.actionBackground,
  },
  draftContent: {
    flex: 1,
  },
  draftEyebrow: {
    color: Colors.sage,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.7,
    marginBottom: 2,
  },
  draftTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  actionSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    marginBottom: 10,
    fontFamily: Fonts.bold,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prayerAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  actionLabel: {
    color: Colors.sage,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.semiBold,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 9,
    paddingHorizontal: 14,
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
    color: Colors.sage,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.semiBold,
  },
  tabTextActive: {
    color: Colors.hopeWhite,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  scroll: {
    flex: 1,
  },
  empty: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    marginBottom: 4,
    fontFamily: Fonts.bold,
    lineHeight: 22,
  },
  emptySubtitle: {
    color: Colors.textGray,
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 21,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'transparent',
    borderColor: Colors.inputBorder,
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  updatePreview: { borderLeftWidth: 2, borderLeftColor: Colors.sageMuted, paddingLeft: 12, marginBottom: 12 },
  updateLabel: { color: Colors.sageMuted, fontSize: 9, lineHeight: 14, letterSpacing: 1.2, marginBottom: 5 },
  updateText: { color: Colors.text, fontSize: 13, lineHeight: 20 },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  prayerTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  cardDate: { marginLeft: 'auto', color: Colors.textGray, fontSize: 10, lineHeight: 15 },
  castSection: { marginTop: 8 },
  castLabel: { color: Colors.sageMuted, fontSize: 9, lineHeight: 13, letterSpacing: 1.2, marginBottom: 4 },
  castBody: { marginBottom: 8 },
  requestContext: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.actionBackground, borderRadius: 8, padding: 10, marginBottom: 12 },
  requestContextText: { flex: 1, color: Colors.textGray, fontSize: 13, lineHeight: 18 },
  requestActionContainer: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 4, paddingTop: 12 },
  requestPrayButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  requestPrayText: { color: Colors.sage, fontSize: 14, lineHeight: 20 },
  cardMeta: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.7,
    marginBottom: 0,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
    fontFamily: Fonts.bold,
  },
  cardBody: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    fontFamily: Fonts.regular,
  },
  prayedMeta: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  cardActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 5,
  },
  cardActionButton: { flex: 1, flexBasis: 0, minWidth: 0, justifyContent: 'center', paddingHorizontal: 5, gap: 4 },
  cardActionText: { flexShrink: 1, fontSize: 10 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 20,
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
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Fonts.semiBold,
  },
  actionButtonTextActive: {
    color: Colors.hopeWhite,
  },
  actionButtonTextDisabled: {
    color: Colors.textGray,
  },
});

export default PrayerListScreen;
