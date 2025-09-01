import React, { useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import Markdown from 'react-native-markdown-display';
// Using a simple error boundary since the custom one isn't available
class ComponentErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null; // Or return a fallback UI
    }
    return this.props.children;
  }
}
import { analytics } from '../../utils/analytics';

// Define the PrayerApiEntry type locally since it's only used for type checking
interface PrayerApiEntry {
  id: string;
  type?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'people' | 'devotional' | 'freeform';
  journal_category?: 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'personal_prayer';
  content: string;
  metadata?: {
    tags?: string[];
    answered?: boolean;
    answeredDate?: string;
    [key: string]: any;
  };
  created_at: string;
  is_answered?: boolean;
  answered_date?: string | null;
  user_id?: string;
  selected_date?: string;
  updated_at?: string;
  devotional_title?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
}
import {
  useACTSPrayerData,
  useCreatePrayer,
  useMarkSupplicationAnswered,
} from '../../services/hooks/usePrayerData';
import ThemedText from '../common/ThemedText';

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
  {
    key: 'freeform',
    label: 'FREE-FORM PRAYER',
    displayName: 'Free-form Prayer',
    color: Colors.anchorBlue,
    description: 'Open Prayer',
    icon: 'create', // Using create/edit icon for free-form
  },
];

interface PrayerJournalCardReactQueryProps {
  selectedDate: Date;
  viewMode?: 'carousel' | 'inline' | 'moments';
}

const PrayerJournalCardReactQuery: React.FC<PrayerJournalCardReactQueryProps> = ({
  selectedDate,
  viewMode: _viewMode,
}) => {
  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // Performance tracking
  const loadStartTime = useRef<number>(Date.now());

  // React Query hooks
  const { data: actsData, isLoading, error, refetch } = useACTSPrayerData(user?.id || '', dateStr);
  const createPrayerMutation = useCreatePrayer();
  const markAnsweredMutation = useMarkSupplicationAnswered();

  // Local state
  const [selectedType, setSelectedType] = useState(PRAYER_TYPES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [prayerText, setPrayerText] = useState('');

  // Performance and analytics tracking
  useEffect(() => {
    if (actsData && !isLoading) {
      const loadTime = Date.now() - loadStartTime.current;
      analytics.trackPrayerEvent('prayers_loaded', {
        acts_count: (actsData.adoration?.length || 0) + (actsData.confession?.length || 0) +
                   (actsData.thanksgiving?.length || 0) + (actsData.supplication?.length || 0) +
                   (actsData.freeform?.length || 0),
        people_count: 0, // This component only handles ACTS prayers
        devotional_count: 0,
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [actsData, isLoading, dateStr, user?.id]);

  // Error analytics tracking
  useEffect(() => {
    if (error) {
      analytics.trackPrayerEvent('prayer_error', {
        error_type: error.message || 'Unknown error',
        operation: 'load_acts_prayers',
        date: dateStr,
      }, user?.id);
    }
  }, [error, dateStr, user?.id]);

  // Reset state when date changes
  useEffect(() => {
    setPrayerText('');
    setIsDropdownOpen(false);
    loadStartTime.current = Date.now();
  }, [dateStr]);

  if (!user) {
    return (
      <View style={styles.card}>
        <ThemedText style={styles.errorText}>Please log in to view prayers</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityLabel="Error loading prayers"
      >
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color={Colors.alertCoral} style={styles.errorIcon} />
          <ThemedText style={styles.errorText}>Unable to load prayers</ThemedText>
          <ThemedText style={styles.errorSubtext}>Please check your connection and try again</ThemedText>
          <TouchableOpacity
            onPress={() => refetch()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading prayers"
            accessibilityHint="Tap to attempt loading prayers again"
          >
            <Ionicons name="refresh" size={16} color={Colors.hopeWhite} style={styles.retryIcon} />
            <ThemedText style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Add prayer logic using React Query
  const handleAddPrayer = async () => {
    if (prayerText.trim() && !createPrayerMutation.isPending) {
      const prayerContent = prayerText.trim();

      // Debug: Check user authentication
      console.log('User context:', { user, userId: user?.id, isAuthenticated: !!user });

      if (!user || !user.id) {
        console.error('User not authenticated or missing ID');
        return;
      }

      try {
        await createPrayerMutation.mutateAsync({
          user_id: user.id,
          content: prayerContent, // Only the main text
          type: selectedType.key as PrayerApiEntry['type'],
          selected_date: dateStr,
          prayer_type: 'journal',
          journal_category: selectedType.key === 'freeform' ? 'personal_prayer' : selectedType.key as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
          status: selectedType.key === 'supplication' ? 'pending' : undefined,
          is_answered: selectedType.key === 'supplication' ? false : undefined,
          metadata: {
            // Add any extra info here, e.g. tags, answered, etc. For now, just an example:
            tags: [],
            answered: selectedType.key === 'supplication' ? false : undefined,
          },
        });

        // Track prayer creation
        analytics.trackPrayerEvent('prayer_created', {
          prayer_type: selectedType.key as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
          content_length: prayerContent.length,
          date: dateStr,
        }, user.id);

        // Track prayer type selection
        analytics.trackPrayerEvent('prayer_type_selected', {
          prayer_type: selectedType.key as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
          date: dateStr,
        }, user.id);

        setPrayerText('');
      } catch (err) {
        // Track error
        analytics.trackPrayerEvent('prayer_error', {
          error_type: err instanceof Error ? err.message : 'Unknown error',
          operation: 'create_prayer',
          prayer_type: selectedType.key,
          date: dateStr,
        }, user.id);

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

      // Track prayer answered event
      if (newIsAnswered) {
        const createdDate = new Date(prayer.created_at);
        const currentDate = new Date();
        const timeDiff = Math.abs(currentDate.getTime() - createdDate.getTime());
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        analytics.trackPrayerEvent('prayer_answered', {
          prayer_id: id,
          prayer_type: 'supplication',
          time_to_answer_days: daysDiff,
          date: dateStr,
        }, user.id);
      }
    } catch (err) {
      // Track error
      analytics.trackPrayerEvent('prayer_error', {
        error_type: err instanceof Error ? err.message : 'Unknown error',
        operation: 'toggle_answered',
        prayer_type: 'supplication',
        date: dateStr,
      }, user.id);

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
            <ThemedText style={styles.prayerGroupTitle}>{type.label}</ThemedText>
          </View>
        </View>

        {prayers.map((prayer) => (
          <View key={prayer.id} style={styles.prayerItem}>
            <Markdown style={prayerMarkdownStyles}>
              {(() => {
                // Only display the 'text' field if content is JSON with a 'text' property
                if (typeof prayer.content === 'string') {
                  try {
                    const parsed = JSON.parse(prayer.content);
                    if (parsed && typeof parsed === 'object' && parsed.text) {
                      return parsed.text;
                    }
                  } catch (e) {
                    // Not JSON, fall through
                  }
                }
                return prayer.content;
              })()}
            </Markdown>

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
                    <ThemedText style={styles.answeredText}>Answered</ThemedText>
                    {prayer.answered_date && (
                      <ThemedText style={styles.answeredDate}>
                        {new Date(prayer.answered_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </ThemedText>
                    )}
                  </View>
                ) : (
                  <View style={styles.waitingContainer}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color="rgba(255, 255, 255, 0.8)"
                      style={styles.pillIcon}
                    />
                    <ThemedText style={styles.pendingText}>Pending</ThemedText>
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
          <Ionicons name="heart" size={20} color={Colors.hopeWhite} style={styles.headerIcon} />
          <ThemedText style={styles.headerTitle}>PRAYER JOURNAL</ThemedText>
        </View>
        <View style={styles.headerPill}>
          <ThemedText style={styles.headerPillText}>
            {actsData ? (actsData.adoration.length + actsData.confession.length + actsData.thanksgiving.length + actsData.supplication.length + actsData.freeform.length) : 0} {(actsData ? (actsData.adoration.length + actsData.confession.length + actsData.thanksgiving.length + actsData.supplication.length + actsData.freeform.length) : 0) === 1 ? 'PRAYER' : 'PRAYERS'}
          </ThemedText>
        </View>
      </View>

      {/* Prayer Type Dropdown */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          accessibilityRole="button"
          accessibilityLabel={`Prayer type: ${selectedType.displayName}`}
          accessibilityHint={`Currently selected ${selectedType.description}. Tap to change prayer type`}
          accessibilityState={{ expanded: isDropdownOpen }}
        >
          <View style={styles.dropdownButtonContent}>
            <Ionicons
              name={selectedType.icon as any}
              size={20}
              color={Colors.anchorBlue}
              style={styles.dropdownIcon}
            />
            <View style={styles.dropdownTextContainer}>
              <ThemedText style={styles.dropdownTitle}>{selectedType.displayName}</ThemedText>
              <ThemedText style={styles.dropdownDesc}>{selectedType.description}</ThemedText>
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
                  <ThemedText style={styles.dropdownItemTitle}>{type.displayName}</ThemedText>
                </View>
                <ThemedText style={styles.dropdownItemDesc}>{type.description}</ThemedText>
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
          accessibilityRole="text"
          accessibilityLabel={`${selectedType.displayName} prayer input`}
          accessibilityHint={`Enter your ${selectedType.description.toLowerCase()} here`}
        />
        <TouchableOpacity
          style={[
            styles.checkButton,
            (!prayerText.trim() || createPrayerMutation.isPending) && styles.disabledButton,
          ]}
          onPress={handleAddPrayer}
          disabled={!prayerText.trim() || createPrayerMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={createPrayerMutation.isPending ? 'Saving prayer' : 'Save prayer'}
          accessibilityHint={`Add this ${selectedType.displayName.toLowerCase()} to your prayer journal`}
          accessibilityState={{ disabled: !prayerText.trim() || createPrayerMutation.isPending }}
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
          {renderPrayerGroup(PRAYER_TYPES[4], actsData.freeform)}
        </>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    marginVertical: 18,
    marginHorizontal: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 10,
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  headerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerPillText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
    opacity: 0.9,
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
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  answeredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 16,
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
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
    justifyContent: 'center',
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answeredDate: {
    color: 'rgba(16, 185, 129, 0.9)',
    fontSize: 10,
    fontFamily: Fonts.medium,
    marginLeft: 4,
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
  errorIcon: {
    marginBottom: 12,
  },
  errorText: {
    color: Colors.error,
    fontFamily: Fonts.medium,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryIcon: {
    marginRight: 4,
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

// Markdown styles for prayer content
const prayerMarkdownStyles = {
  body: {
    color: Colors.anchorBlue,
    fontSize: 14,
    lineHeight: 20,
  },
  heading1: {
    color: Colors.anchorBlue,
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 6,
  },
  heading2: {
    color: Colors.anchorBlue,
    fontSize: 16,
    fontWeight: 'bold' as const,
    marginBottom: 4,
  },
  strong: {
    color: Colors.anchorBlue,
    fontWeight: 'bold' as const,
  },
  em: {
    color: Colors.anchorBlue,
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.anchorBlue,
    paddingLeft: 8,
    paddingVertical: 4,
    marginVertical: 4,
  },
  list_item: {
    color: Colors.anchorBlue,
    marginBottom: 2,
  },
};

// Wrap with error boundary for production safety
const PrayerJournalCardWithErrorBoundary: React.FC<PrayerJournalCardReactQueryProps> = (props) => (
  <ComponentErrorBoundary>
    <PrayerJournalCardReactQuery {...props} />
  </ComponentErrorBoundary>
);

export default PrayerJournalCardWithErrorBoundary;
