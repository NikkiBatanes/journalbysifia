import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateString } from '../../utils/date';

// Define the PrayerApiEntry type locally since it's only used for type checking
type PrayerApiEntry = {
  id: string;
  type: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'people' | 'devotional';
  content: string;
  created_at: string;
  is_answered?: boolean;
  user_id?: string;
  selected_date?: string;
  updated_at?: string;
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
};
import {
  useACTSPrayerData,
  useCreatePrayer,
  useMarkSupplicationAnswered,
} from '../../services/hooks/usePrayerData';

// Prayer types and descriptions
const PRAYER_TYPES = [
  {
    key: 'adoration',
    label: 'ADORATION',
    displayName: 'Adoration',
    color: Colors.anchorBlue,
    description: 'Praising God',
    icon: 'star', // Using star instead of sparkles
  },
  {
    key: 'confession',
    label: 'CONFESSION',
    displayName: 'Confession',
    color: Colors.anchorBlue, // Using anchorBlue for all
    description: 'Acknowledging Sins',
    icon: 'heart', // Using heart instead of heart-broken
  },
  {
    key: 'thanksgiving',
    label: 'THANKSGIVING',
    displayName: 'Thanksgiving',
    color: Colors.anchorBlue, // Using anchorBlue for all
    description: 'Giving Thanks',
    icon: 'gift',
  },
  {
    key: 'supplication',
    label: 'SUPPLICATION',
    displayName: 'Supplication',
    color: Colors.anchorBlue, // Using anchorBlue for all
    description: 'Making Requests',
    icon: 'hand-right', // Using hand-right instead of hands-praying
  },
];

interface PrayerJournalCardReactQueryProps {
  selectedDate: Date;
}

const PrayerJournalCardReactQuery: React.FC<PrayerJournalCardReactQueryProps> = ({
  selectedDate,
}) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks
  const { data: actsData, isLoading, error, refetch } = useACTSPrayerData(user?.id || '', dateStr);
  const createPrayerMutation = useCreatePrayer();
  const markAnsweredMutation = useMarkSupplicationAnswered();

  // Local state
  const [selectedType, setSelectedType] = useState(PRAYER_TYPES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [prayerText, setPrayerText] = useState('');

  // Reset state when date changes
  React.useEffect(() => {
    setPrayerText('');
    setIsDropdownOpen(false);
    console.log('🙏 PrayerJournalCard: Resetting state for date:', dateStr);
  }, [dateStr]);

  if (!user) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>Please log in to view prayers</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <Text style={styles.loadingText}>Loading prayers...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading prayers</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }



  // Add prayer logic using React Query
  const handleAddPrayer = async () => {
    if (prayerText.trim() && !createPrayerMutation.isPending) {
      try {
        await createPrayerMutation.mutateAsync({
          user_id: user.id,
          content: prayerText.trim(),
          type: selectedType.key as PrayerApiEntry['type'],
          selected_date: dateStr,
          is_answered: selectedType.key === 'supplication' ? false : undefined,
        });
        setPrayerText('');
      } catch (err) {
        console.error('Error adding prayer:', err);
        // Error is handled by React Query
      }
    }
  };

  // Toggle supplication answered status using React Query
  const handleToggleAnswered = async (id: string) => {
    if (!actsData) {return;}

    try {
      const prayer = actsData.supplication.find(p => p.id === id);
      if (!prayer) {return;}

      const newIsAnswered = !prayer.is_answered;
      await markAnsweredMutation.mutateAsync({
        id,
        isAnswered: newIsAnswered,
        _userId: user.id,
        _dateStr: dateStr,
      });
    } catch (err) {
      console.error('Error updating prayer status:', err);
      // Error is handled by React Query
    }
  };

  const renderPrayerGroup = (
    type: typeof PRAYER_TYPES[0],
    prayers: PrayerApiEntry[]
  ) => {
    if (prayers.length === 0) {return null;}

    return (
      <View key={type.key} style={styles.prayerGroupCard}>
        <View style={styles.prayerGroupHeader}>
          <View style={styles.prayerTypeBadge}>
            <Text style={styles.prayerGroupTitle}>{type.label}</Text>
          </View>
        </View>

        {prayers.map((prayer) => (
          <View key={prayer.id} style={styles.prayerItem}>
            <Text style={styles.prayerText}>{prayer.content}</Text>

            {/* Show status for supplication prayers */}
            {type.key === 'supplication' && (
              <TouchableOpacity
                style={prayer.is_answered ? styles.answeredPill : styles.pendingPill}
                onPress={() => handleToggleAnswered(prayer.id)}
                disabled={markAnsweredMutation.isPending}
              >
                {prayer.is_answered ? (
                  <View style={styles.answeredContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={Colors.success}
                      style={styles.pillIcon}
                    />
                    <Text style={styles.answeredText}>Answered</Text>
                  </View>
                ) : (
                  <View style={styles.waitingContainer}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color="rgba(255, 255, 255, 0.8)"
                      style={styles.pillIcon}
                    />
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="heart" size={24} color={Colors.anchorBlue} />
          <Text style={styles.headerTitle}>Prayer Journal</Text>
          <Text style={styles.headerSubtitle}>ACTS Model</Text>
        </View>
        {actsData && (actsData.adoration.length + actsData.confession.length + actsData.thanksgiving.length + actsData.supplication.length) > 0 && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {actsData.adoration.length + actsData.confession.length + actsData.thanksgiving.length + actsData.supplication.length}
            </Text>
          </View>
        )}
      </View>

      {/* Prayer Type Dropdown */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <View style={styles.dropdownButtonContent}>
            <Ionicons
              name={selectedType.icon as any}
              size={20}
              color={Colors.anchorBlue}
              style={styles.dropdownIcon}
            />
            <View style={styles.dropdownTextContainer}>
              <Text style={styles.dropdownTitle}>{selectedType.displayName}</Text>
              <Text style={styles.dropdownDesc}>{selectedType.description}</Text>
            </View>
          </View>
          <Ionicons
            name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.anchorBlue}
          />
        </TouchableOpacity>

        {isDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {PRAYER_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedType(type);
                  setIsDropdownOpen(false);
                }}
              >
                <Ionicons
                  name={type.icon as any}
                  size={18}
                  color={Colors.anchorBlue}
                  style={styles.dropdownIcon}
                />
                <View style={styles.dropdownTextContainer}>
                  <Text style={styles.dropdownItemTitle}>{type.displayName}</Text>
                </View>
                <Text style={styles.dropdownItemDesc}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={`Enter your ${selectedType.displayName.toLowerCase()}...`}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={prayerText}
          onChangeText={setPrayerText}
          multiline
          textAlignVertical="top"
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.checkButton,
            (!prayerText.trim() || createPrayerMutation.isPending) && styles.disabledButton,
          ]}
          onPress={handleAddPrayer}
          disabled={!prayerText.trim() || createPrayerMutation.isPending}
        >
          {createPrayerMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.anchorBlue} />
          ) : (
            <Ionicons name="checkmark" size={24} color={Colors.anchorBlue} />
          )}
        </TouchableOpacity>
      </View>

      {/* Prayer Groups */}
      {actsData && (
        <>
          {renderPrayerGroup(PRAYER_TYPES[0], actsData.adoration)}
          {renderPrayerGroup(PRAYER_TYPES[1], actsData.confession)}
          {renderPrayerGroup(PRAYER_TYPES[2], actsData.thanksgiving)}
          {renderPrayerGroup(PRAYER_TYPES[3], actsData.supplication)}
        </>
      )}

      {actsData && actsData.adoration.length === 0 && actsData.confession.length === 0 && actsData.thanksgiving.length === 0 && actsData.supplication.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No prayers yet for this date</Text>
          <Text style={styles.emptySubtext}>Add your first prayer above</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(26, 60, 109, 0.3)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.hopeWhite,
    marginLeft: 12,
    marginRight: 8,
  },
  headerSubtitle: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.anchorBlue,
    letterSpacing: 1,
  },
  dropdownContainer: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 12,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  dropdownDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.anchorBlue,
    opacity: 0.8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 60, 109, 0.95)',
    borderRadius: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 20,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  dropdownItemTitle: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  dropdownItemDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.anchorBlue,
    opacity: 0.8,
    marginLeft: 'auto',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    color: Colors.hopeWhite,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    paddingRight: 60, // Space for check button
    minHeight: 150,
    maxHeight: 300,
    textAlignVertical: 'top',
    fontFamily: Fonts.regular,
    lineHeight: 24,
    ...Platform.select({
      android: {
        textAlignVertical: 'top',
        paddingTop: 12,
      },
      ios: {
        paddingTop: 8,
      },
    }),
  },
  checkButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  prayerGroupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.anchorBlue,
  },
  prayerGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
  },
  prayerTypeBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    marginRight: 8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.hopeWhite,
  },
  prayerGroupTitle: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
  },
  prayerItem: {
    backgroundColor: 'rgba(26, 60, 109, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    minHeight: 80,
  },
  prayerText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 24,
    marginRight: 8,
    paddingRight: 80,
    paddingBottom: 24,
    fontFamily: Fonts.regular,
    letterSpacing: 0.2,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  answeredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(209, 250, 229, 0.2)',
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  pendingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginRight: 4,
    letterSpacing: 0.2,
  },
  answeredText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  pillIcon: {
    marginLeft: 0,
    marginRight: 4,
  },
  answeredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1,
  },
  counterText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    color: Colors.error,
    fontFamily: Fonts.regular,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.anchorBlue,
    fontFamily: Fonts.regular,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
});

export default PrayerJournalCardReactQuery;
