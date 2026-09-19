import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ChevronDown } from 'lucide-react-native';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {FadeInUp} from 'react-native-reanimated';

import ThemedText from '../components/common/ThemedText';
import PrayerHandsIcon from '../components/common/PrayerHandsIcon';
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
import PrayerCard, { PrayerHomeEntry } from '../components/journal/PrayerCard';
import { isTrackedPrayer, isPrayerActive, isPrayerLetGo, hasAnswerHistory, trackingStatus, prayerNeeds, answerPrayer, releasePrayer, type PrayerUpdate } from '../utils/prayerTracking';
import { getLatestPrayerDraft, PrayerDraft } from '../storage/prayerDraftStorage';
import { useScroll } from '../context/ScrollContext';

type PrayerTab = 'active' | 'released' | 'needs' | 'requests' | 'answered' | 'all';
type PrayerTimeframe = 'day' | 'week' | 'month';
type PrayerTypeFilter = 'cast' | 'open' | 'person' | 'request' | 'need';
type PrayerSort = 'updated' | 'added' | 'oldest' | 'prayed' | 'waiting';

const TABS: { key: PrayerTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Still praying' },
  { key: 'released', label: 'Let go' },
  { key: 'needs', label: 'Needs' },
  { key: 'requests', label: 'Requests' },
  { key: 'answered', label: 'Answered' },
];

const TIMEFRAMES: {key: PrayerTimeframe; label: string}[] = [
  {key: 'day', label: 'Days'},
  {key: 'week', label: 'Weeks'},
  {key: 'month', label: 'Months'},
];

const PRAYER_TYPES: {key: PrayerTypeFilter; label: string}[] = [
  {key: 'cast', label: 'CAST'},
  {key: 'open', label: 'Open'},
  {key: 'person', label: 'For Someone'},
  {key: 'request', label: 'Request'},
  {key: 'need', label: 'Prayer Need'},
];

const SORT_OPTIONS: {key: PrayerSort; label: string}[] = [
  {key: 'updated', label: 'Recently updated'},
  {key: 'added', label: 'Recently added'},
  {key: 'oldest', label: 'Oldest first'},
  {key: 'prayed', label: 'Prayed recently'},
  {key: 'waiting', label: 'Waiting longest'},
];

const CAST_ORDER = ['confession', 'adoration', 'supplication', 'thanksgiving'];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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


const PrayerListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, preferences: appPreferences } = useAuth();
  const prayerUserId = user?.id || 'local';
  const { showTabBar, setShowTabBar } = useScroll();
  const queryClient = useQueryClient();
  const [trackingMode, setTrackingMode] = useState<'update' | 'details'>('update');
  const [trackingPrayer, setTrackingPrayer] = useState<PrayerHomeEntry | null>(null);
  const [creatingNeed, setCreatingNeed] = useState(false);
  const [respondingTo, setRespondingTo] = useState<PrayerHomeEntry | null>(null);
  const answerInFlight = useRef(false);
  const scrollRef = useRef<any>(null);
  const lastScrollYRef = useRef(0);
  const tabBarCollapsedRef = useRef(false);
  const [prayerContentReady, setPrayerContentReady] = useState(false);
  const [prayerEntranceRun, setPrayerEntranceRun] = useState(0);
  const [answering, setAnswering] = useState(false);
  const createPrayer = useCreatePrayer();
  const deletePrayer = useDeletePrayer();
  const [activeTab, setActiveTab] = useState<PrayerTab>('all');
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [latestDraft, setLatestDraft] = useState<PrayerDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState<PrayerTimeframe>('day');
  const [selectedTypes, setSelectedTypes] = useState<PrayerTypeFilter[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<PrayerSort>('updated');
  const [filterOpen, setFilterOpen] = useState(false);
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    getLatestPrayerDraft().then((draft) => {
      if (active) {setLatestDraft(draft);}
    });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    if (showTabBar && lastScrollYRef.current > 60) {
      tabBarCollapsedRef.current = false;
    }
  }, [showTabBar]);

  const handlePrayerScroll = useCallback((event: any) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const isScrollingUp = y < lastScrollYRef.current;
    lastScrollYRef.current = y;

    if (y > 60 && !tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = true;
      setShowTabBar(false);
    } else if (isScrollingUp && y <= 0 && tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }
  }, [setShowTabBar]);

  // The bottom-nav add menu's "Prayer Need" action lands here with this param
  useFocusEffect(useCallback(() => {
    if (route.params?.openNeedModal) {
      setCreatingNeed(true);
      navigation.setParams({ openNeedModal: undefined });
    }
  }, [navigation, route.params?.openNeedModal]));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subscription = DeviceEventEmitter.addListener('prayerSaved', () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
      setShowSavedConfirmation(true);
      timeout = setTimeout(() => setShowSavedConfirmation(false), 2200);
    });

    return () => {
      subscription.remove();
      if (timeout) {clearTimeout(timeout);}
    };
  }, [prayerUserId, queryClient]);

  const { data: prayers = [], isLoading, refetch: refetchPrayers } = useAllPrayerData(prayerUserId);
  const updatePrayer = useUpdatePrayer();
  const markPrayed = useMarkPrayerRequestPrayed();
  const groupedPrayers = useMemo(() => groupPrayerEntries(prayers), [prayers]);

  useFocusEffect(useCallback(() => {
    let focused = true;
    setPrayerContentReady(false);
    lastScrollYRef.current = 0;
    tabBarCollapsedRef.current = false;
    setShowTabBar(true);

    void refetchPrayers().finally(() => {
      if (!focused) {return;}
      setPrayerEntranceRun(run => run + 1);
      setPrayerContentReady(true);
    });

    return () => {
      focused = false;
      setPrayerContentReady(false);
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    };
  }, [refetchPrayers, setShowTabBar]));

  const pendingRequests = useMemo(() => groupedPrayers.filter(p => p.is_prayer_request === true && p.prayed !== true && trackingStatus(p) === 'pending'), [groupedPrayers]);
  const prayerNeedEntries = useMemo(() => groupedPrayers.filter(p => p.metadata?.prayer_need === true), [groupedPrayers]);

  const weekStartsOn = Math.max(
    0,
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .indexOf(appPreferences?.weekStart || 'monday'),
  ) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const prayerType = useCallback((prayer: PrayerHomeEntry): PrayerTypeFilter => {
    if (prayer.metadata?.prayer_need) return 'need';
    if (prayer.is_prayer_request) return 'request';
    if (prayer.metadata?.prayer_style === 'cast' || prayer.groupedEntries) return 'cast';
    if (prayer.metadata?.prayer_style === 'open' || prayer.journal_category === 'personal_prayer') return 'open';
    return 'person';
  }, []);

  const prayerTopics = useCallback((prayer: PrayerHomeEntry) => {
    const saved = prayer.metadata?.topics;
    return [
      prayer.metadata?.topic,
      ...(Array.isArray(saved) ? saved : []),
      ...prayerNeeds(prayer).map(need => need.topic),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }, []);

  const peopleOptions = useMemo(() => [...new Set(groupedPrayers.map(prayer => prayer.person_name?.trim()).filter((value): value is string => !!value))].sort(), [groupedPrayers]);
  const topicOptions = useMemo(() => [...new Set(groupedPrayers.flatMap(prayerTopics))].sort(), [groupedPrayers, prayerTopics]);
  const activeFilterCount = selectedTypes.length + selectedPeople.length + selectedTopics.length + (sortMode === 'updated' ? 0 : 1);
  const totalFilterCount = activeFilterCount + (activeTab === 'all' ? 0 : 1);

  const filteredPrayers = useMemo(() => {
    let result: PrayerHomeEntry[];
    switch (activeTab) {
      case 'active':
        result = groupedPrayers.filter(p => isPrayerActive(p) && !(p.is_prayer_request && !p.prayed));
        break;
      case 'released':
        result = groupedPrayers.filter(isPrayerLetGo);
        break;
      case 'needs':
        result = prayerNeedEntries;
        break;
      case 'requests':
        result = pendingRequests;
        break;
      case 'answered':
        result = groupedPrayers.filter(hasAnswerHistory);
        break;
      case 'all':
      default:
        result = groupedPrayers;
    }

    if (selectedTypes.length) result = result.filter(prayer => selectedTypes.includes(prayerType(prayer)));
    if (selectedPeople.length) result = result.filter(prayer => !!prayer.person_name && selectedPeople.includes(prayer.person_name.trim()));
    if (selectedTopics.length) result = result.filter(prayer => prayerTopics(prayer).some(topic => selectedTopics.includes(topic)));

    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter(prayer => {
        const savedUpdates = prayer.metadata?.prayer_updates;
        const updates: PrayerUpdate[] = Array.isArray(savedUpdates) ? savedUpdates : [];
        const searchable = [
          prayer.content,
          prayer.notes,
          prayer.person_name,
          prayer.metadata?.prayer_request_display,
          prayer.metadata?.original_request_content,
          ...prayerNeeds(prayer).map(need => need.text),
          ...prayerTopics(prayer),
          ...updates.map(update => update.text),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(normalizedSearch);
      });
    }

    const timestamp = (prayer: PrayerHomeEntry, field: 'created_at' | 'updated_at' | 'last_prayed_at') => {
      const value = prayer[field];
      const parsed = value ? new Date(value).getTime() : 0;
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...result].sort((a, b) => {
      if (sortMode === 'added') return timestamp(b, 'created_at') - timestamp(a, 'created_at');
      if (sortMode === 'oldest' || sortMode === 'waiting') return timestamp(a, 'created_at') - timestamp(b, 'created_at');
      if (sortMode === 'prayed') return timestamp(b, 'last_prayed_at') - timestamp(a, 'last_prayed_at');
      return timestamp(b, 'updated_at') - timestamp(a, 'updated_at') || timestamp(b, 'created_at') - timestamp(a, 'created_at');
    });
  }, [activeTab, groupedPrayers, pendingRequests, prayerNeedEntries, prayerTopics, prayerType, searchQuery, selectedPeople, selectedTopics, selectedTypes, sortMode]);

  const groupedResults = useMemo(() => {
    const sections = new Map<string, {key: string; title: string; date: Date; prayers: PrayerHomeEntry[]}>();

    filteredPrayers.forEach(prayer => {
      const raw = prayer.selected_date || prayer.created_at;
      if (!raw) return;
      const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
      if (Number.isNaN(date.getTime())) return;

      let key: string;
      let title: string;
      let sectionDate: Date;
      if (timeframe === 'week') {
        const start = startOfWeek(date, {weekStartsOn});
        const end = endOfWeek(date, {weekStartsOn});
        key = format(start, 'yyyy-MM-dd');
        title = `${format(start, 'MMM d')} – ${format(end, end.getFullYear() === start.getFullYear() ? 'MMM d, yyyy' : 'MMM d, yyyy')}`;
        sectionDate = start;
      } else if (timeframe === 'month') {
        key = format(date, 'yyyy-MM');
        title = format(date, 'MMMM yyyy');
        sectionDate = new Date(date.getFullYear(), date.getMonth(), 1);
      } else {
        key = format(date, 'yyyy-MM-dd');
        title = format(date, date.getFullYear() === new Date().getFullYear() ? 'EEEE, MMMM d' : 'EEEE, MMMM d, yyyy');
        sectionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }

      const section = sections.get(key);
      if (section) section.prayers.push(prayer);
      else sections.set(key, {key, title, date: sectionDate, prayers: [prayer]});
    });

    const direction = sortMode === 'oldest' || sortMode === 'waiting' ? 1 : -1;
    return [...sections.values()].sort((a, b) => direction * (a.date.getTime() - b.date.getTime()));
  }, [filteredPrayers, sortMode, timeframe, weekStartsOn]);

  const changeTimeframe = (next: PrayerTimeframe) => {
    triggerLightHaptic();
    LayoutAnimation.configureNext({
      duration: 260,
      create: {type: 'easeInEaseOut', property: 'opacity'},
      update: {type: 'easeInEaseOut'},
      delete: {type: 'easeInEaseOut', property: 'opacity'},
    });
    setTimeframe(next);
    setTimeframeOpen(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({y: 0, animated: true}));
  };

  const handlePrayAgain = async (prayer: PrayerHomeEntry) => {
    try {
      triggerLightHaptic();
      const target = prayer.groupedEntries?.find((entry) => entry.journal_category === 'supplication')
        || prayer.groupedEntries?.[0]
        || prayer;
      await markPrayed.mutateAsync({
        id: target.id,
        isPrayed: true,
        _userId: prayerUserId,
        _dateStr: prayer.selected_date,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
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
      await updatePrayer.mutateAsync({ id: target.id, updates, _userId: prayerUserId, _dateStr: target.selected_date });
      const requestId = target.is_prayer_request ? target.id : target.metadata?.original_request_id;
      const related = requestId ? prayers.filter(p => p.id !== target.id && (p.id === requestId || p.metadata?.original_request_id === requestId)) : [];
      for (const linked of related) await updatePrayer.mutateAsync({ id: linked.id, updates: { ...updates, metadata: { ...linked.metadata, ...Object.fromEntries(['track_answered', 'is_active', 'tracking_status', 'answer_history', 'lifecycle_history', 'prayer_needs', 'prayer_updates'].filter(key => (updates.metadata as Record<string, any>)[key] !== undefined).map(key => [key, (updates.metadata as Record<string, any>)[key]])) } }, _userId: prayerUserId, _dateStr: linked.selected_date });
      await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
      triggerSuccessHaptic();
    } catch { Alert.alert('Could not update prayer', 'Please try again.'); }
    finally { answerInFlight.current = false; setAnswering(false); }
  };

  const handleRelease = async (prayer: PrayerHomeEntry) => {
    if (answerInFlight.current) return;
    triggerLightHaptic();
    answerInFlight.current = true;
    setAnswering(true);
    try {
      const target = prayer.groupedEntries?.find(p => p.journal_category === 'supplication') || prayer.groupedEntries?.[0] || prayer;
      const updates = releasePrayer(target);
      await updatePrayer.mutateAsync({ id: target.id, updates, _userId: prayerUserId, _dateStr: target.selected_date });
      const requestId = target.is_prayer_request ? target.id : target.metadata?.original_request_id;
      const related = requestId ? prayers.filter(p => p.id !== target.id && (p.id === requestId || p.metadata?.original_request_id === requestId)) : [];
      for (const linked of related) await updatePrayer.mutateAsync({ id: linked.id, updates: { ...updates, metadata: { ...linked.metadata, ...Object.fromEntries(['track_answered', 'is_active', 'tracking_status', 'answer_history', 'lifecycle_history', 'prayer_needs', 'prayer_updates'].filter(key => (updates.metadata as Record<string, any>)[key] !== undefined).map(key => [key, (updates.metadata as Record<string, any>)[key]])) } }, _userId: prayerUserId, _dateStr: linked.selected_date });
      await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
      triggerSuccessHaptic();
    } catch { Alert.alert('Could not update prayer', 'Please try again.'); }
    finally { answerInFlight.current = false; setAnswering(false); }
  };

  const saveTracking = async (data: Parameters<React.ComponentProps<typeof PrayerTrackingModal>['onSave']>[0]) => {
    if (trackingPrayer) {
      const target = trackingPrayer.groupedEntries?.find(p => p.journal_category === 'supplication') || trackingPrayer.groupedEntries?.[0] || trackingPrayer;
      const { content, ...trackingUpdates } = data;
      const updates = { ...trackingUpdates, content };
      await updatePrayer.mutateAsync({ id: target.id, updates, _userId: prayerUserId, _dateStr: target.selected_date });
      const requestId = target.is_prayer_request ? target.id : target.metadata?.original_request_id;
      const related = requestId ? prayers.filter(p => p.id !== target.id && (p.id === requestId || p.metadata?.original_request_id === requestId)) : [];
      for (const linked of related) await updatePrayer.mutateAsync({ id: linked.id, updates: { status: data.status, answered_date: data.answered_date, metadata: { ...linked.metadata, ...Object.fromEntries(['track_answered', 'is_active', 'tracking_status', 'answer_history', 'lifecycle_history', 'prayer_needs', 'prayer_updates'].filter(key => data.metadata[key] !== undefined).map(key => [key, data.metadata[key]])) } }, _userId: prayerUserId, _dateStr: linked.selected_date });
    } else {
      await createPrayer.mutateAsync({ ...data, user_id: user?.id || 'local', selected_date: format(new Date(), 'yyyy-MM-dd'), prayer_type: 'journal', journal_category: 'supplication', prayed: false, prayer_count: 0 });
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
    DeviceEventEmitter.emit('prayerSaved');
    triggerSuccessHaptic();
  };

  const deleteTrackingPrayer = async () => {
    if (!trackingPrayer) return;
    for (const entry of trackingPrayer.groupedEntries || [trackingPrayer]) await deletePrayer.mutateAsync({ id: entry.id, _userId: prayerUserId, _dateStr: entry.selected_date });
    await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
    DeviceEventEmitter.emit('prayer_deleted');
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

  const toggleSelection = <T extends string>(value: T, values: T[], setValues: React.Dispatch<React.SetStateAction<T[]>>) => {
    triggerLightHaptic();
    setValues(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const clearAdvancedFilters = () => {
    triggerLightHaptic();
    setActiveTab('all');
    setSelectedTypes([]);
    setSelectedPeople([]);
    setSelectedTopics([]);
    setSortMode('updated');
  };

  const applyQuickView = (view: 'attention' | 'waiting' | 'answered' | 'others' | 'needs') => {
    triggerLightHaptic();
    setFilterOpen(false);
    setSelectedPeople([]);
    setSelectedTopics([]);
    if (view === 'attention') { setActiveTab('active'); setSelectedTypes([]); setSortMode('updated'); }
    if (view === 'waiting') { setActiveTab('active'); setSelectedTypes([]); setSortMode('waiting'); }
    if (view === 'answered') { setActiveTab('answered'); setSelectedTypes([]); setSortMode('updated'); }
    if (view === 'others') { setActiveTab('all'); setSelectedTypes(['person', 'request']); setSortMode('updated'); }
    if (view === 'needs') { setActiveTab('needs'); setSelectedTypes(['need']); setSortMode('updated'); }
  };

  const hasActiveFilterChips = activeTab !== 'all' || selectedTypes.length > 0 || selectedPeople.length > 0 || selectedTopics.length > 0 || sortMode !== 'updated';
  const stickyHeaderIndices = useMemo(() => {
    if (!prayerContentReady || isLoading || groupedResults.length === 0) return [];
    let childIndex = (showSavedConfirmation ? 1 : 0)
      + (latestDraft ? 1 : 0)
      + (hasActiveFilterChips ? 1 : 0);
    return groupedResults.map(section => {
      const index = childIndex;
      childIndex += 1 + section.prayers.length;
      return index;
    });
  }, [groupedResults, hasActiveFilterChips, isLoading, latestDraft, prayerContentReady, showSavedConfirmation]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top}]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftRow}>
            <PrayerHandsIcon size={20} color={Colors.text} />
            <ThemedText weight="bold" style={styles.headerTitle}>Prayers</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerControlPill} onPress={() => { triggerLightHaptic(); setTimeframeOpen(true); }}>
              <ThemedText weight="semiBold" style={styles.headerControlText}>{TIMEFRAMES.find(item => item.key === timeframe)?.label}</ThemedText>
              <ChevronDown size={14} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerCircleButton} onPress={() => { triggerLightHaptic(); setFilterOpen(true); }} accessibilityLabel="Filter prayers">
              <MaterialCommunityIcons name="tune" size={16} color={Colors.text} />
              {totalFilterCount > 0 && <View style={styles.filterBadge}><ThemedText weight="bold" style={styles.filterBadgeText}>{totalFilterCount}</ThemedText></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerCircleButton} onPress={() => { triggerLightHaptic(); setShowSearch(value => !value); if (showSearch) setSearchQuery(''); }} accessibilityLabel={showSearch ? 'Close prayer search' : 'Search prayers'}>
              <Ionicons name={showSearch ? 'close' : 'search'} size={17} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        {!showSearch && <ThemedText style={styles.headerSubtitle}>Your prayers and prayer requests</ThemedText>}
        {showSearch && <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textGray} style={styles.searchIcon} />
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search Prayers..."
              placeholderTextColor={Colors.placeholderText}
              textAlignVertical="center"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              keyboardAppearance="light"
            />
          </View>
          {!!searchQuery && <TouchableOpacity onPress={() => { triggerLightHaptic(); setSearchQuery(''); }} style={styles.clearButton} accessibilityLabel="Clear prayer search"><Ionicons name="close-circle" size={16} color={Colors.placeholderText} /></TouchableOpacity>}
        </View>}
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: !isLoading && filteredPrayers.length === 0 ? 0 : insets.bottom + 80},
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handlePrayerScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={stickyHeaderIndices}
      >
      {prayerContentReady && showSavedConfirmation && (
        <Animated.View
          key={`${prayerEntranceRun}:saved-confirmation`}
          entering={FadeInUp.springify().damping(14).stiffness(180)}
          style={styles.savedConfirmation}
        >
          <Ionicons name="checkmark-circle" size={17} color={Colors.growthGreen} />
          <ThemedText weight="medium" style={styles.savedConfirmationText}>Prayer saved</ThemedText>
        </Animated.View>
      )}

      {prayerContentReady && latestDraft && (
        <Animated.View
          key={`${prayerEntranceRun}:draft`}
          entering={FadeInUp.delay(80).springify().damping(14).stiffness(180)}
        >
          <TouchableOpacity style={styles.draftCard} onPress={handleContinueDraft} activeOpacity={0.75}>
            <View style={styles.draftIcon}>
              <PrayerHandsIcon size={18} color={Colors.sage} />
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
        </Animated.View>
      )}

      {prayerContentReady && hasActiveFilterChips && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersScroll} contentContainerStyle={styles.activeFiltersRow}>
        {activeTab !== 'all' && <TouchableOpacity style={styles.activeFilterPill} onPress={() => { triggerLightHaptic(); setActiveTab('all'); }}><ThemedText style={styles.activeFilterText}>{TABS.find(tab => tab.key === activeTab)?.label}</ThemedText><Ionicons name="close" size={13} color={Colors.sage} /></TouchableOpacity>}
        {selectedTypes.map(value => <TouchableOpacity key={value} style={styles.activeFilterPill} onPress={() => toggleSelection(value, selectedTypes, setSelectedTypes)}><ThemedText style={styles.activeFilterText}>{PRAYER_TYPES.find(item => item.key === value)?.label}</ThemedText><Ionicons name="close" size={13} color={Colors.sage} /></TouchableOpacity>)}
        {selectedPeople.map(value => <TouchableOpacity key={value} style={styles.activeFilterPill} onPress={() => toggleSelection(value, selectedPeople, setSelectedPeople)}><ThemedText style={styles.activeFilterText}>{value}</ThemedText><Ionicons name="close" size={13} color={Colors.sage} /></TouchableOpacity>)}
        {selectedTopics.map(value => <TouchableOpacity key={value} style={styles.activeFilterPill} onPress={() => toggleSelection(value, selectedTopics, setSelectedTopics)}><ThemedText style={styles.activeFilterText}>{value}</ThemedText><Ionicons name="close" size={13} color={Colors.sage} /></TouchableOpacity>)}
        {sortMode !== 'updated' && <TouchableOpacity style={styles.activeFilterPill} onPress={() => { triggerLightHaptic(); setSortMode('updated'); }}><ThemedText style={styles.activeFilterText}>{SORT_OPTIONS.find(item => item.key === sortMode)?.label}</ThemedText><Ionicons name="close" size={13} color={Colors.sage} /></TouchableOpacity>}
      </ScrollView>}

      {!prayerContentReady ? null : isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.sage} />
        </View>
      ) : filteredPrayers.length === 0 ? (
            <View style={styles.empty}>
              <PrayerHandsIcon size={32} color={Colors.textGray} style={styles.emptyIcon} />
              <ThemedText weight="semiBold" style={styles.emptyTitle}>{searchQuery.trim() ? `No prayers match “${searchQuery.trim()}”.` : activeFilterCount > 0 ? 'No prayers match these filters.' : activeTab === 'needs' ? 'No Prayer Needs Yet' : activeTab === 'requests' ? 'No Requests Waiting' : activeTab === 'answered' ? 'No Answered Prayers Yet' : activeTab === 'released' ? 'No Prayers Let Go Yet' : 'No Prayers Yet'}</ThemedText>
              <ThemedText style={styles.emptySubtitle}>{searchQuery.trim() || activeFilterCount > 0 ? 'Try another search or clear a filter.' : activeTab === 'needs' ? 'You haven’t saved any prayer needs yet.' : activeTab === 'requests' ? 'You haven’t received any prayer requests yet.' : activeTab === 'answered' ? 'You haven’t marked any prayers as answered yet.' : activeTab === 'released' ? 'You haven’t let go of any prayers yet.' : 'You haven’t saved any prayers yet.'}</ThemedText>
            </View>
      ) : (
            groupedResults.flatMap((section, sectionIndex) => [
                <Animated.View
                  key={`${prayerEntranceRun}:header-${timeframe}-${section.key}`}
                  entering={FadeInUp.delay(Math.min(sectionIndex * 160, 560)).springify().damping(14).stiffness(180)}
                  style={styles.sectionHeader}
                >
                  <ThemedText weight="semiBold" numberOfLines={1} style={styles.sectionTitle}>{section.title}</ThemedText>
                  {(() => {
                    const requestCount = section.prayers.filter(
                      prayer => prayer.is_prayer_request === true && prayer.prayed !== true && trackingStatus(prayer) === 'pending'
                    ).length;

                    return requestCount > 0 ? (
                      <View
                        style={styles.sectionRequestBadge}
                        accessibilityRole="text"
                        accessibilityLabel={`${requestCount} waiting prayer ${requestCount === 1 ? 'request' : 'requests'}`}
                      >
                        <Ionicons name="mail-unread-outline" size={12} color={Colors.alertCoral} />
                        <ThemedText weight="semiBold" numberOfLines={1} style={styles.sectionRequestBadgeText}>
                          {requestCount} {requestCount === 1 ? 'request' : 'requests'}
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText numberOfLines={1} style={styles.sectionCount}>{section.prayers.length} {section.prayers.length === 1 ? 'prayer' : 'prayers'}</ThemedText>
                    );
                  })()}
                </Animated.View>,
                ...section.prayers.map((prayer, prayerIndex) => (
                  <Animated.View
                    key={`${prayerEntranceRun}:prayer-${prayer.id}`}
                    entering={FadeInUp.delay(Math.min((sectionIndex * 2 + prayerIndex + 1) * 80, 640)).springify().damping(14).stiffness(180)}
                  >
                    <PrayerCard
                      prayer={prayer}
                      onPrayAgain={handlePrayAgain}
                      onEdit={handleEditPrayer}
                      onManageAnswers={p => { triggerLightHaptic(); setTrackingMode('details'); setTrackingPrayer(p); }}
                      onManage={p => { triggerLightHaptic(); setTrackingMode(isTrackedPrayer(p) ? 'update' : 'details'); setTrackingPrayer(p); }}
                      onAnswered={handleAnswered}
                      onRelease={handleRelease}
                      answering={answering}
                      onAddPrayer={handleAddPrayer}
                    />
                  </Animated.View>
                )),
            ])
      )}
      <View style={{ height: 24 }} />

      </ScrollView>
      <Modal visible={timeframeOpen} transparent animationType="fade" onRequestClose={() => setTimeframeOpen(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setTimeframeOpen(false)}>
          <TouchableOpacity style={styles.timeframePicker} activeOpacity={1} onPress={() => {}}>
            <ThemedText weight="semiBold" style={styles.pickerTitle}>VIEW PRAYERS BY</ThemedText>
            <View style={styles.pickerOptions}>{TIMEFRAMES.map(option => { const active = timeframe === option.key; return <TouchableOpacity key={option.key} style={[styles.pickerOption, active && styles.pickerOptionActive]} onPress={() => changeTimeframe(option.key)}><ThemedText weight="medium" style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>{option.label}</ThemedText></TouchableOpacity>; })}</View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setFilterOpen(false)}>
          <TouchableOpacity style={[styles.filterSheet, {paddingBottom: insets.bottom + 20}]} activeOpacity={1} onPress={() => {}}>
            <View style={styles.filterHeader}>
              <View><ThemedText weight="bold" style={styles.filterTitle}>Filter prayers</ThemedText><ThemedText style={styles.filterSubtitle}>Choose any combination.</ThemedText></View>
              <TouchableOpacity style={styles.filterClose} onPress={() => { triggerLightHaptic(); setFilterOpen(false); }} accessibilityLabel="Close filters"><Ionicons name="close" size={18} color={Colors.hopeWhite} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
              <ThemedText weight="semiBold" style={styles.filterSectionLabel}>QUICK VIEWS</ThemedText>
              <View style={styles.filterPills}>{([
                ['attention', 'Needs attention'],
                ['waiting', 'Waiting longest'],
                ['answered', 'Recently answered'],
                ['others', 'For others'],
                ['needs', 'Prayer needs'],
              ] as const).map(([key, label]) => <TouchableOpacity key={key} style={styles.sheetPill} onPress={() => applyQuickView(key)}><ThemedText weight="medium" style={styles.sheetPillText}>{label}</ThemedText></TouchableOpacity>)}</View>

              <ThemedText weight="semiBold" style={styles.filterSectionLabel}>STATUS</ThemedText>
              <View style={styles.filterPills}>{TABS.map(tab => { const active = activeTab === tab.key; return <TouchableOpacity key={tab.key} style={[styles.sheetPill, active && styles.sheetPillActive]} onPress={() => { triggerLightHaptic(); setActiveTab(tab.key); }}><ThemedText weight="medium" style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>{tab.label}{tab.key === 'needs' && prayerNeedEntries.length ? ` · ${prayerNeedEntries.length}` : tab.key === 'requests' && pendingRequests.length ? ` · ${pendingRequests.length}` : ''}</ThemedText></TouchableOpacity>; })}</View>

              <ThemedText weight="semiBold" style={styles.filterSectionLabel}>PRAYER TYPE</ThemedText>
              <View style={styles.filterPills}>{PRAYER_TYPES.map(item => { const active = selectedTypes.includes(item.key); return <TouchableOpacity key={item.key} style={[styles.sheetPill, active && styles.sheetPillActive]} onPress={() => toggleSelection(item.key, selectedTypes, setSelectedTypes)}><ThemedText weight="medium" style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>{item.label}</ThemedText></TouchableOpacity>; })}</View>

              {peopleOptions.length > 0 && <><ThemedText weight="semiBold" style={styles.filterSectionLabel}>PEOPLE</ThemedText><View style={styles.filterPills}>{peopleOptions.map(person => { const active = selectedPeople.includes(person); return <TouchableOpacity key={person} style={[styles.sheetPill, active && styles.sheetPillActive]} onPress={() => toggleSelection(person, selectedPeople, setSelectedPeople)}><ThemedText weight="medium" style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>{person}</ThemedText></TouchableOpacity>; })}</View></>}

              {topicOptions.length > 0 && <><ThemedText weight="semiBold" style={styles.filterSectionLabel}>TOPICS</ThemedText><View style={styles.filterPills}>{topicOptions.map(topic => { const active = selectedTopics.includes(topic); return <TouchableOpacity key={topic} style={[styles.sheetPill, active && styles.sheetPillActive]} onPress={() => toggleSelection(topic, selectedTopics, setSelectedTopics)}><ThemedText weight="medium" style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>{topic}</ThemedText></TouchableOpacity>; })}</View></>}

              <ThemedText weight="semiBold" style={styles.filterSectionLabel}>SORT BY</ThemedText>
              <View style={styles.filterPills}>{SORT_OPTIONS.map(item => <TouchableOpacity key={item.key} style={[styles.sheetPill, sortMode === item.key && styles.sheetPillActive]} onPress={() => { triggerLightHaptic(); setSortMode(item.key); }}><ThemedText weight="medium" style={[styles.sheetPillText, sortMode === item.key && styles.sheetPillTextActive]}>{item.label}</ThemedText></TouchableOpacity>)}</View>
            </ScrollView>
            <View style={styles.filterFooter}>
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAdvancedFilters}><ThemedText weight="semiBold" style={styles.clearFiltersText}>Clear</ThemedText></TouchableOpacity>
              <TouchableOpacity style={styles.showResultsButton} onPress={() => { triggerLightHaptic(); setFilterOpen(false); }}><ThemedText weight="bold" style={styles.showResultsText}>Show {filteredPrayers.length} {filteredPrayers.length === 1 ? 'prayer' : 'prayers'}</ThemedText></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {respondingTo && <PrayerResponseSheet request={respondingTo} onClose={() => setRespondingTo(null)} onSaved={async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) }); setRespondingTo(null); }} />}
      {(creatingNeed || trackingPrayer) && <PrayerTrackingModal onDelete={trackingPrayer ? deleteTrackingPrayer : undefined} mode={trackingPrayer ? trackingMode : 'details'} onShowDetails={() => setTrackingMode('details')} prayer={trackingPrayer ? (trackingPrayer.groupedEntries?.find(p => p.journal_category === 'supplication') || trackingPrayer.groupedEntries?.[0] || trackingPrayer) : undefined} onClose={() => { setCreatingNeed(false); setTrackingPrayer(null); DeviceEventEmitter.emit('pencilAddFlowClosed'); }} onSave={saveTracking} />}
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
    flexGrow: 1,
  },
  header: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    marginBottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 0,
    backgroundColor: Colors.lightBackground,
  },
  headerTopRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginTop: 6, marginBottom: 0},
  headerLeftRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  headerTitle: {fontSize: 24, fontFamily: Fonts.bold, color: Colors.text, letterSpacing: 0.5, flex: 0},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto'},
  headerControlPill: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(82, 106, 91, 0.08)', borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)'},
  headerControlText: {fontSize: 13, fontFamily: Fonts.regular, color: Colors.text},
  headerCircleButton: {width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(82, 106, 91, 0.08)', borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)'},
  filterBadge: {position: 'absolute', top: -5, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, backgroundColor: Colors.alertCoral},
  filterBadgeText: {fontSize: 8, color: Colors.hopeWhite},
  headerSubtitle: {fontSize: 14, color: Colors.textGray, fontFamily: Fonts.regular, marginTop: 4, marginBottom: 8},
  searchBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 999,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 0,
  },
  searchIcon: {marginRight: 8},
  searchInputWrapper: {flex: 1, height: '100%', justifyContent: 'center'},
  searchInput: {width: '100%', height: Platform.OS === 'ios' ? 22 : '100%', color: Colors.text, fontFamily: Fonts.regular, fontSize: 15, lineHeight: Platform.OS === 'ios' ? 20 : undefined, padding: 0, margin: 0, includeFontPadding: false, textAlignVertical: 'center'},
  clearButton: {marginLeft: 8, padding: 4},
  timeframeScroll: {marginHorizontal: -18, marginBottom: 12, flexGrow: 0},
  timeframeRow: {paddingHorizontal: 18, gap: 7},
  timeframePill: {minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground},
  timeframePillActive: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  timeframeText: {fontSize: 11, color: Colors.sage},
  timeframeTextActive: {color: Colors.hopeWhite},
  periodNavigator: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16},
  periodArrow: {width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBackground},
  periodLabel: {flex: 1, textAlign: 'center', color: Colors.text, fontSize: 12},
  quickScroll: {marginHorizontal: -18, marginTop: -4, marginBottom: 14, flexGrow: 0},
  quickRow: {paddingHorizontal: 18, gap: 7},
  quickPill: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 17, backgroundColor: Colors.actionBackground},
  quickText: {fontSize: 10, color: Colors.sage},
  sectionHeader: {alignSelf: 'stretch', position: 'relative', height: 38, marginHorizontal: -18, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.lightBackground},
  sectionTitle: {position: 'absolute', left: 18, right: 108, top: 3, fontSize: 18, lineHeight: 24, color: Colors.text, fontFamily: Fonts.semiBold},
  sectionCount: {position: 'absolute', right: 18, top: 3, fontSize: 12, lineHeight: 24, color: Colors.textGray, fontFamily: Fonts.regular, textAlign: 'right'},
  sectionRequestBadge: {position: 'absolute', right: 18, top: 2, height: 26, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(217, 120, 114, 0.12)', borderWidth: 1, borderColor: 'rgba(217, 120, 114, 0.28)'},
  sectionRequestBadgeText: {fontSize: 11, lineHeight: 15, color: Colors.alertCoral, letterSpacing: 0.2},
  filterButton: {minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBackground},
  filterButtonActive: {backgroundColor: Colors.sage, borderColor: Colors.sage},
  filterButtonText: {fontSize: 11, color: Colors.sage},
  filterButtonTextActive: {color: Colors.hopeWhite},
  activeFiltersScroll: {marginHorizontal: -18, marginTop: -4, marginBottom: 12, flexGrow: 0},
  activeFiltersRow: {paddingHorizontal: 18, gap: 7},
  activeFilterPill: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.actionBackground},
  activeFilterText: {fontSize: 10, color: Colors.sage},
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
  tabsScroll: {
    marginHorizontal: -18,
    marginBottom: 20,
    flexGrow: 0,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  tab: {
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 17,
    borderRadius: 22,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  tabActive: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  tabText: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: Fonts.semiBold,
  },
  tabTextActive: {
    color: Colors.hopeWhite,
  },
  filterOverlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)'},
  pickerOverlay: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)'},
  timeframePicker: {width: 280, maxWidth: '86%', padding: 20, borderRadius: 24, backgroundColor: Colors.sage},
  pickerTitle: {fontSize: 16, color: Colors.hopeWhite, marginBottom: 16, textTransform: 'uppercase'},
  pickerOptions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pickerOption: {justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)'},
  pickerOptionActive: {backgroundColor: Colors.sageMuted, borderColor: Colors.sageMuted},
  pickerOptionText: {fontSize: 14, color: Colors.hopeWhite},
  pickerOptionTextActive: {color: Colors.hopeWhite},
  filterSheet: {maxHeight: '82%', backgroundColor: Colors.sage, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20},
  filterHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16},
  filterTitle: {fontSize: 20, color: Colors.hopeWhite},
  filterSubtitle: {fontSize: 12, color: 'rgba(255,254,250,0.72)', marginTop: 2},
  filterClose: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)'},
  filterSheetContent: {paddingHorizontal: 20, paddingBottom: 18},
  filterSectionLabel: {fontSize: 11, letterSpacing: 1.5, color: Colors.hopeWhite, marginTop: 17, marginBottom: 10},
  filterPills: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  sheetPill: {justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)'},
  sheetPillActive: {backgroundColor: Colors.sageMuted, borderColor: Colors.sageMuted},
  sheetPillText: {fontSize: 14, color: Colors.hopeWhite},
  sheetPillTextActive: {color: Colors.hopeWhite},
  filterFooter: {flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)'},
  clearFiltersButton: {minHeight: 46, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)'},
  clearFiltersText: {fontSize: 14, color: Colors.hopeWhite},
  showResultsButton: {flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: Colors.hopeWhite},
  showResultsText: {fontSize: 14, color: Colors.sage},
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textGray,
    textAlign: 'center',
  },
  emptyIcon: {
    marginBottom: 8,
  },
});

export default PrayerListScreen;
