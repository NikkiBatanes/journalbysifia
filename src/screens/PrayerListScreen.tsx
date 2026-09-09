import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import {
  useAllPeoplePrayerData,
  useUpdatePrayer,
  useMarkPrayerRequestPrayed,
} from '../services/hooks/usePrayerData';
import { PrayerApiEntry } from '../services/api/prayerApi';
import { queryKeys } from '../services/queryKeys';

type PrayerTab = 'active' | 'answered' | 'people';

const TABS: { key: PrayerTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'answered', label: 'Answered' },
  { key: 'people', label: 'People' },
];

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
}: {
  prayer: PrayerApiEntry;
  onPrayAgain: (prayer: PrayerApiEntry) => void;
  onMarkAnswered: (prayer: PrayerApiEntry) => void;
}) => {
  const isAnswered = prayer.status === 'answered' || prayer.is_answered;
  const isPrayerRequest = prayer.is_prayer_request === true;
  const title = prayer.person_name || prayer.content?.split('.')[0] || 'Prayer';
  const body = prayer.content || prayer.notes || '';

  return (
    <View style={styles.card}>
      <ThemedText style={styles.cardMeta}>
        {isPrayerRequest ? 'REQUESTED ' : 'STARTED '}{formatStarted(prayer.created_at)}
      </ThemedText>
      <ThemedText weight="semiBold" style={styles.cardTitle}>{title}</ThemedText>
      {body && title !== body && (
        <ThemedText style={styles.cardBody} numberOfLines={3}>{body}</ThemedText>
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

  const { data: prayers = [], isLoading } = useAllPeoplePrayerData(user?.id || '');
  const updatePrayer = useUpdatePrayer();
  const markPrayed = useMarkPrayerRequestPrayed();

  const filteredPrayers = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return prayers.filter((p) => p.status !== 'answered' && !p.is_answered);
      case 'answered':
        return prayers.filter((p) => p.status === 'answered' || p.is_answered);
      case 'people':
      default:
        return prayers.filter((p) => p.is_prayer_request === true);
    }
  }, [activeTab, prayers]);

  const handlePrayAgain = async (prayer: PrayerApiEntry) => {
    try {
      triggerLightHaptic();
      await markPrayed.mutateAsync({
        id: prayer.id,
        isPrayed: true,
        _userId: user?.id || '',
        _dateStr: prayer.selected_date,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allPeople(user?.id || '') });
      triggerSuccessHaptic();
    } catch (err) {
      Alert.alert('Error', 'Could not mark prayer as prayed.');
    }
  };

  const handleMarkAnswered = async (prayer: PrayerApiEntry) => {
    try {
      triggerLightHaptic();
      if (prayer.status === 'answered' || prayer.is_answered) {
        await updatePrayer.mutateAsync({
          id: prayer.id,
          updates: { status: 'pending', answered_date: null },
          _userId: user?.id || '',
          _dateStr: prayer.selected_date,
        });
      } else {
        await updatePrayer.mutateAsync({
          id: prayer.id,
          updates: { status: 'answered', answered_date: new Date().toISOString() },
          _userId: user?.id || '',
          _dateStr: prayer.selected_date,
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allPeople(user?.id || '') });
      triggerSuccessHaptic();
    } catch (err) {
      Alert.alert('Error', 'Could not update prayer status.');
    }
  };

  const handleNewPrayer = () => {
    triggerLightHaptic();
    navigation.navigate('PrayersForPeopleWalkthrough', { selectedDate: new Date().toISOString() });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>PRAYER</ThemedText>
        <ThemedText style={styles.title}>Bring it to God.</ThemedText>
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
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={styles.newPrayerButton} onPress={handleNewPrayer} activeOpacity={0.8}>
        <Ionicons name="add" size={20} color={Colors.hopeWhite} />
        <ThemedText weight="semiBold" style={styles.newPrayerText}>New prayer</ThemedText>
      </TouchableOpacity>
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
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
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
  cardActions: {
    flexDirection: 'row',
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
  newPrayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.sage,
    borderRadius: 24,
    paddingVertical: 16,
    marginTop: 12,
  },
  newPrayerText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 20,
  },
});

export default PrayerListScreen;
