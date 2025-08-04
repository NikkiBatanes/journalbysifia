import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { JournalCard } from './JournalCard';
import { Check, X, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useACTSPrayerData,
  useCreatePrayer,
  useMarkSupplicationAnswered,
} from '../../services/hooks/usePrayerData';
import { ErrorBoundary } from '../ErrorBoundary';
import { analytics } from '../../utils/analytics';
import { useEditModeSafe } from '../../systems/journal/context/EditModeContext';

// Prayer types for ACTS method and freeform
const PRAYER_TYPES = [
  {
    key: 'adoration',
    label: 'ADORATION',
    displayName: 'Adoration',
    color: Colors.hopeWhite,
    description: 'Worshiping God for who He is and His character',
    icon: 'star',
    method: 'ACTS',
  },
  {
    key: 'confession',
    label: 'CONFESSION',
    displayName: 'Confession',
    color: Colors.hopeWhite,
    description: 'Acknowledging sins and seeking forgiveness',
    icon: 'heart',
    method: 'ACTS',
  },
  {
    key: 'thanksgiving',
    label: 'THANKSGIVING',
    displayName: 'Thanksgiving',
    color: Colors.hopeWhite,
    description: 'Thanking God for everything',
    icon: 'gift',
    method: 'ACTS',
  },
  {
    key: 'supplication',
    label: 'SUPPLICATION',
    displayName: 'Supplication',
    color: Colors.hopeWhite,
    description: 'Bringing your personal requests to God',
    icon: 'hand-left',
    method: 'ACTS',
  },
  {
    key: 'freeform',
    label: 'OPEN PRAYER',
    displayName: 'Open Prayer',
    color: Colors.growthGreen,
    description: 'Pray freely from your heart',
    icon: 'chatbubble-ellipses-outline',
    method: 'Freeform',
  },
];

// Helper function to format answered date
const formatAnsweredDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return 'No date';
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const dateYear = date.getFullYear();

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };

    // Only include year if it's different from current year
    if (dateYear !== currentYear) {
      options.year = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error formatting date';
  }
};

interface PrayerJournalProps {
  selectedDate?: Date;
  refreshKey?: number;
  variant?: 'carousel' | 'inline';
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

export const PrayerJournalReactQuery: React.FC<PrayerJournalProps> = ({
  selectedDate = new Date(),
  variant = 'carousel',
  viewMode,
  expanded,
  onExpand,
}) => {
  // Global edit mode context (only for inline view)
  const globalEditMode = useEditModeSafe();

  const { user } = useAuth();
  const dateStr = toLocalDateString(selectedDate);

  // React Query hooks
  const { data: prayerEntries = [] } = useACTSPrayerData(user?.id || '', dateStr);
  const createMutation = useCreatePrayer();
  const markAnsweredMutation = useMarkSupplicationAnswered();

  // Local state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPrayerType, setSelectedPrayerType] = useState<string>('adoration');
  const [prayerText, setPrayerText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transform API data to local format
  const existingPrayers = useMemo(() => {
    if (!prayerEntries || typeof prayerEntries !== 'object') {return [];}

    // Handle the case where prayerEntries is an object with prayer type arrays
    const prayerData = prayerEntries as any;
    const allPrayers = [
      ...(prayerData.adoration || []),
      ...(prayerData.confession || []),
      ...(prayerData.thanksgiving || []),
      ...(prayerData.supplication || []),
      ...(prayerData.freeform || []),
    ];

    return allPrayers.map((entry: any) => ({
      id: entry.id,
      type: entry.journal_category === 'personal_prayer' ? 'freeform' : (entry.journal_category || 'adoration'),
      content: entry.content,
      created_at: entry.created_at,
      status: entry.status,
      is_answered: entry.is_answered,
      answered_at: entry.answered_date,
    }));
  }, [prayerEntries]);

  // Check if we have content to display
  const hasContent = existingPrayers.length > 0;

  // Get dynamic subtitle based on context
  const getSubtitle = () => {
    if (isEditing) {
      const selectedType = PRAYER_TYPES.find(t => t.key === selectedPrayerType);
      return selectedType?.method === 'ACTS' ? 'ACTS Method Prayer' : 'Open Prayer';
    }
    if (hasContent) {
      const totalCount = existingPrayers.length;
      const supplicationCount = existingPrayers.filter(p => p.type === 'supplication').length;
      const openCount = existingPrayers.filter(p => p.type === 'freeform').length;
      const answeredCount = existingPrayers.filter(p => p.is_answered).length;

      // Main prayer count line
      let subtitle = totalCount === 1 ? '1 Prayer' : `${totalCount} Prayers`;

      // Add prayer type breakdown
      const typeParts = [];
      if (supplicationCount > 0) {
        typeParts.push(`${supplicationCount} Supplication`);
      }
      if (openCount > 0) {
        typeParts.push(`${openCount} Open`);
      }

      if (typeParts.length > 0) {
        subtitle += ` • ${typeParts.join(', ')}`;
      }

      // Add answered count on a new line if there are answered prayers
      if (answeredCount > 0) {
        subtitle += `\n${answeredCount} Answered Prayer${answeredCount !== 1 ? 's' : ''}`;
      }

      return subtitle;
    }
    return 'ACTS & Open Prayer';
  };

  // Handle edit mode
  const toggleEditing = useCallback(() => {
    if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
      globalEditMode.setGlobalEditMode(false);
    } else if (viewMode === 'inline') {
      globalEditMode?.setGlobalEditMode(true);
    }
    setIsEditing(!isEditing);
  }, [isEditing, globalEditMode, viewMode]);

  // Handle prayer type selection
  const handlePrayerTypeSelect = useCallback((type: string) => {
    setSelectedPrayerType(type);
  }, []);

  // Handle save prayer
  const handleSavePrayer = useCallback(async () => {
    if (!prayerText.trim()) {
      Alert.alert('Empty Prayer', 'Please enter your prayer before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await createMutation.mutateAsync({
        user_id: user?.id || '',
        selected_date: dateStr,
        prayer_type: 'journal',
        journal_category: selectedPrayerType === 'freeform' ? 'personal_prayer' : selectedPrayerType as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
        content: prayerText.trim(),
        status: (selectedPrayerType === 'freeform' || selectedPrayerType === 'supplication') ? 'pending' : undefined,
      });

      // Track analytics
      analytics.track('prayer_journal_entry_created', {
        prayer_type: selectedPrayerType,
        date: dateStr,
        content_length: prayerText.trim().length,
      });

      // Reset form
      setPrayerText('');
      setSelectedPrayerType('adoration');
      setIsEditing(false);

      if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
        globalEditMode.setGlobalEditMode(false);
      }
    } catch (saveError) {
      console.error('Error saving prayer:', saveError);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [prayerText, selectedPrayerType, user?.id, dateStr, createMutation, globalEditMode, viewMode]);

  // Handle cancel editing
  const handleCancelEdit = useCallback(() => {
    setPrayerText('');
    setSelectedPrayerType('adoration');
    setIsEditing(false);

    if (globalEditMode?.isGlobalEditMode && viewMode === 'inline') {
      globalEditMode.setGlobalEditMode(false);
    }
  }, [globalEditMode, viewMode]);

  // Handle mark prayer as answered
  const handleMarkAnswered = useCallback(async (prayerId: string, isAnswered: boolean) => {
    try {
      await markAnsweredMutation.mutateAsync({
        id: prayerId,
        isAnswered,
        _userId: user?.id || '',
        _dateStr: dateStr,
      });

      analytics.track('prayer_marked_answered', {
        prayer_id: prayerId,
        is_answered: isAnswered,
        date: dateStr,
      });
    } catch (error) {
      console.error('Error marking prayer as answered:', error);
      Alert.alert('Error', 'Failed to update prayer status. Please try again.');
    }
  }, [markAnsweredMutation, dateStr, user?.id]);

  // Handle global edit mode changes for inline view
  React.useEffect(() => {
    if (viewMode === 'inline' && globalEditMode?.isGlobalEditMode && !isEditing) {
      setIsEditing(true);
    } else if (viewMode === 'inline' && !globalEditMode?.isGlobalEditMode && isEditing) {
      setIsEditing(false);
      setPrayerText('');
      setSelectedPrayerType('adoration');
    }
  }, [globalEditMode?.isGlobalEditMode, viewMode, isEditing]);

  // Render prayer type selector
  const renderPrayerTypeSelector = () => {
    const actsTypes = PRAYER_TYPES.filter(type => type.method === 'ACTS');
    const freeformTypes = PRAYER_TYPES.filter(type => type.method === 'Freeform');

    return (
      <View style={styles.prayerTypeContainer}>
        <Text style={styles.sectionTitle}>Choose Prayer Style</Text>

        {/* ACTS Method Section */}
        <View style={styles.methodSection}>
          <View style={styles.methodHeader}>
            <Text style={styles.methodTitle}>ACTS Method</Text>
            <Text style={styles.methodSubtitle}>Structured prayer approach</Text>
          </View>
          <View style={styles.prayerTypeGrid}>
            {actsTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.prayerTypeButton,
                  selectedPrayerType === type.key && styles.prayerTypeButtonSelected,
                ]}
                onPress={() => handlePrayerTypeSelect(type.key)}
              >
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={selectedPrayerType === type.key ? Colors.hopeWhite : Colors.mediumGray}
                />
                <Text
                  style={[
                    styles.prayerTypeText,
                    selectedPrayerType === type.key && styles.prayerTypeTextSelected,
                  ]}
                >
                  {type.displayName}
                </Text>
                <Text style={styles.prayerTypeDescription}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Open Prayer Section */}
        <View style={styles.methodSection}>
          <View style={styles.methodHeader}>
            <Text style={styles.methodTitle}>Open Prayer</Text>
            <Text style={styles.methodSubtitle}>A simple, unstructured prayer</Text>
          </View>
          <View style={styles.prayerTypeGrid}>
            {freeformTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.prayerTypeButtonFreeform,
                  selectedPrayerType === type.key && styles.prayerTypeButtonFreeformSelected,
                ]}
                onPress={() => handlePrayerTypeSelect(type.key)}
              >
                <Ionicons
                  name={type.icon}
                  size={20}
                  color={selectedPrayerType === type.key ? Colors.hopeWhite : Colors.mediumGray}
                />
                <Text
                  style={[
                    styles.prayerTypeTextFreeform,
                    selectedPrayerType === type.key && styles.prayerTypeTextFreeformSelected,
                  ]}
                >
                  {type.displayName}
                </Text>
                <Text style={styles.prayerTypeDescriptionFreeform}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Render prayer input
  const renderPrayerInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {PRAYER_TYPES.find(t => t.key === selectedPrayerType)?.displayName} Prayer
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder={`Write your ${selectedPrayerType} prayer...`}
        placeholderTextColor={Colors.mediumGray}
        value={prayerText}
        onChangeText={setPrayerText}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <View style={styles.editButtonBar}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancelEdit}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <X size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.saveButton, (!prayerText.trim() || isSaving) && styles.disabledButton]}
          onPress={handleSavePrayer}
          disabled={isSaving || !prayerText.trim()}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          <Check size={14} color={Colors.hopeWhite} strokeWidth={3.5} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render existing prayers
  const renderExistingPrayers = () => (
    <ScrollView
      style={[
        styles.prayersContainer,
        (expanded || viewMode === 'inline') && styles.prayersContainerExpanded,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {PRAYER_TYPES.map((type) => {
        const typePrayers = existingPrayers.filter((p: any) => p.type === type.key);
        if (typePrayers.length === 0) {return null;}

        return (
          <View key={type.key} style={styles.prayerTypeSection}>
            <View style={styles.prayerTypeSectionHeader}>
              <Ionicons
                name={type.icon}
                size={16}
                color={Colors.hopeWhite}
              />
              <Text style={styles.prayerTypeSectionTitle}>{type.displayName}</Text>
            </View>
            {typePrayers.map((prayer: any) => (
              <View key={prayer.id} style={styles.prayerItem}>
                <Text style={styles.prayerContent}>{prayer.content}</Text>
                {(prayer.type === 'freeform' || prayer.type === 'supplication') && prayer.status === 'pending' && !prayer.is_answered && (
                  <TouchableOpacity
                    style={styles.markAnsweredButton}
                    onPress={() => handleMarkAnswered(prayer.id, true)}
                  >
                    <Ionicons name="time-outline" size={16} color="#FF9500" />
                    <Text style={styles.markAnsweredText}>Mark Answered</Text>
                  </TouchableOpacity>
                )}
                {(prayer.type === 'freeform' || prayer.type === 'supplication') && prayer.is_answered && (
                  <TouchableOpacity
                    style={styles.answeredIndicator}
                    onPress={() => handleMarkAnswered(prayer.id, false)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
                    <View style={styles.answeredTextContainer}>
                      <Text style={styles.answeredText}>Answered</Text>
                      <Text style={styles.answeredTimestamp}>
                        {prayer.answered_at ? formatAnsweredDate(prayer.answered_at) : 'Recently'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <ErrorBoundary>
      <JournalCard
        icon={hasContent || isEditing ? (
          <Ionicons
            name="hand-left-outline"
            size={24}
            color={Colors.alertCoral}
          />
        ) : undefined}
        title={hasContent || isEditing ? 'PRAYER JOURNAL' : undefined}
        subtitle={hasContent || isEditing ? getSubtitle() : undefined}
        variant={variant}
        viewMode={viewMode}
        expanded={expanded}
        onExpand={onExpand}
        showAddButton={hasContent || isEditing ? !isEditing : false}
        onAdd={toggleEditing}
        isAdding={isEditing}
        onCancelAdd={handleCancelEdit}
      >
        {isEditing ? (
          <View style={styles.editContainer}>
            {renderPrayerTypeSelector()}
            {renderPrayerInput()}
          </View>
        ) : hasContent ? (
          renderExistingPrayers()
        ) : (viewMode === 'inline' || viewMode === 'moments') ? null : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="hand-left-outline"
                size={32}
                color={Colors.mediumGray}
                style={styles.emptyStateIcon}
              />
              <Text style={styles.sectionLabel} accessibilityRole="text">
                PRAYER JOURNAL
              </Text>
            </View>
            <View style={styles.titleContainer}>
              <Text
                style={styles.emptyStateTitle}
                accessibilityRole="header"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Connect with God in Prayer
              </Text>
            </View>
            <Text style={styles.emptyStateSubtext}>
              Offer your personal prayers to deepen your faith.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={toggleEditing}
            >
              <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
              <Text style={styles.emptyStateButtonText}>Begin</Text>
            </TouchableOpacity>
          </View>
        )}
      </JournalCard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  editContainer: {
    gap: 16,
  },
  prayerTypeContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    marginBottom: 4,
  },
  methodSection: {
    gap: 12,
  },
  methodHeader: {
    gap: 2,
    marginBottom: 8,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  methodSubtitle: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    opacity: 0.8,
  },
  prayerTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prayerTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prayerTypeButtonSelected: {
    backgroundColor: Colors.growthGreen + '20',
    borderColor: Colors.growthGreen,
  },
  prayerTypeButtonFreeform: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prayerTypeButtonFreeformSelected: {
    backgroundColor: Colors.growthGreen + '20',
    borderColor: Colors.growthGreen,
  },
  prayerTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.mediumGray,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  prayerTypeTextSelected: {
    color: Colors.hopeWhite,
  },
  prayerTypeTextFreeform: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.mediumGray,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  prayerTypeTextFreeformSelected: {
    color: Colors.hopeWhite,
  },
  prayerTypeDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
    marginTop: 6,
  },
  prayerTypeDescriptionFreeform: {
    fontSize: 16,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
    marginTop: 6,
  },
  inputContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  textInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 24,
  },
  editButtonBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
    padding: 0,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButton: {
    backgroundColor: Colors.alertCoral,
  },
  disabledButton: {
    opacity: 0.5,
  },
  prayersContainer: {
    maxHeight: 200,
  },
  prayersContainerExpanded: {
    maxHeight: undefined,
  },
  prayerTypeSection: {
    marginBottom: 8,
  },
  prayerTypeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  prayerTypeSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  prayerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  prayerContent: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    lineHeight: 24,
    letterSpacing: 0.1,
    fontStyle: 'italic',
  },
  markAnsweredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 6,
  },
  markAnsweredText: {
    fontSize: 11,
    color: '#FF9500',
    fontFamily: Fonts.regular,
  },
  answeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  answeredText: {
    fontSize: 11,
    color: Colors.growthGreen,
    fontFamily: Fonts.regular,
    fontWeight: '500',
  },
  answeredTextContainer: {
    marginLeft: 4,
  },
  answeredTimestamp: {
    fontSize: 9,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: Colors.mediumGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.9,
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  emptyStateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  emptyStateButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
});
