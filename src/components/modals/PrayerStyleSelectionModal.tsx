import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import { X, Check } from 'lucide-react-native'; // Unused
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerSelectionHaptic } from '../../utils/haptics';
import { getFontFamily, DEFAULT_FONT_FAMILY } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';

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

interface PrayerStyleSelectionModalProps {
  visible: boolean;
  selectedPrayerType: string;
  prayerText: string;
  onSelectPrayerType: (type: string) => void;
  onPrayerTextChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const PrayerStyleSelectionModal: React.FC<PrayerStyleSelectionModalProps> = ({
  visible,
  selectedPrayerType,
  prayerText,
  onSelectPrayerType,
  onPrayerTextChange,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  const [activeTab, setActiveTab] = useState<'ACTS' | 'OPEN'>('ACTS');
  const theme = useTheme();
  const regularFont = getFontFamily(theme.currentFont || DEFAULT_FONT_FAMILY, 'regular');
  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle prayer type selection

  const handlePrayerTypeSelect = useCallback((type: string) => {
    if (type !== selectedPrayerType) {
      triggerSelectionHaptic();
    }
    onSelectPrayerType(type);
  }, [selectedPrayerType, onSelectPrayerType]);

  // Handle tab change and align selected type
  const handleTabChange = useCallback((tab: 'ACTS' | 'OPEN') => {
    setActiveTab(prev => {
      if (prev !== tab) {
        triggerSelectionHaptic();
      }
      return tab;
    });
    if (tab === 'OPEN') {
      onSelectPrayerType('freeform');
    } else if (tab === 'ACTS' && selectedPrayerType === 'freeform') {
      onSelectPrayerType('adoration');
    }
  }, [selectedPrayerType, onSelectPrayerType]);

  // Filter prayer types by method
  const actsTypes = PRAYER_TYPES.filter(type => type.method === 'ACTS');

  // Helper function to get placeholder text for ACTS prayer types
  const getPlaceholderForPrayerType = (type: string) => {
    switch (type) {
      case 'adoration':
        return 'Express your worship and praise to God for who He is...';
      case 'confession':
        return 'Confess your sins and ask for God\'s forgiveness...';
      case 'thanksgiving':
        return 'Thank God for His blessings and goodness in your life...';
      case 'supplication':
        return 'Bring your requests and needs before God...';
      default:
        return `Write your ${type} prayer...`;
    }
  };

  // Reset tab when modal opens
  React.useEffect(() => {
    if (visible) {
      if (selectedPrayerType === 'freeform') {
        setActiveTab('OPEN');
      } else {
        setActiveTab('ACTS');
      }
    }
  }, [visible, selectedPrayerType]);

  // Handle keyboard events
  useEffect(() => {
    if (!visible) {return;}

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // No-op
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header - Fixed at top with pointerEvents to ensure it's always tappable */}
        <View style={styles.header} pointerEvents="box-none">
          <TouchableOpacity
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={styles.headerButton}
          >
            <ThemedText style={styles.headerButtonText} weight="medium">Cancel</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle} weight="semiBold">
            Write Prayer
          </ThemedText>

          <TouchableOpacity
            onPress={onSave}
            disabled={!prayerText.trim() || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save Prayer"
            style={styles.headerButton}
          >
            <ThemedText style={[styles.headerButtonText, (!prayerText.trim() || isSaving) && styles.disabledText]} weight="medium">Save</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'ACTS' && styles.tabButtonActive]}
              onPress={() => handleTabChange('ACTS')}
              accessibilityRole="tab"
              accessibilityLabel="ACTS Method"
              accessibilityState={{ selected: activeTab === 'ACTS' }}
            >
              <ThemedText style={[styles.tabText, activeTab === 'ACTS' && styles.tabTextActive]} weight="semiBold">
                ACTS Method
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'OPEN' && styles.tabButtonActive]}
              onPress={() => handleTabChange('OPEN')}
              accessibilityRole="tab"
              accessibilityLabel="Open Prayer"
              accessibilityState={{ selected: activeTab === 'OPEN' }}
            >
              <ThemedText style={[styles.tabText, activeTab === 'OPEN' && styles.tabTextActive]} weight="semiBold">
                Open Prayer
              </ThemedText>
            </TouchableOpacity>
          </View>

          {activeTab === 'ACTS' ? (
            <View style={styles.methodSection}>
              <View style={styles.methodHeader}>
                <ThemedText style={styles.methodTitle} weight="bold">ACTS Method</ThemedText>
                <ThemedText style={styles.methodSubtitle}>Structured prayer approach</ThemedText>
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
                    accessibilityRole="button"
                    accessibilityLabel={`${type.displayName} prayer type`}
                    accessibilityState={{ selected: selectedPrayerType === type.key }}
                  >
                    <Ionicons
                      name={type.icon}
                      size={24}
                      color={selectedPrayerType === type.key ? Colors.hopeWhite : Colors.textGray}
                    />
                    <ThemedText
                      style={[
                        styles.prayerTypeText,
                        selectedPrayerType === type.key && styles.prayerTypeTextSelected,
                      ]}
                      weight="semiBold"
                    >
                      {type.displayName}
                    </ThemedText>
                    <ThemedText style={styles.prayerTypeDescription}>{type.description}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.methodSection}>
              <View style={styles.methodHeader}>
                <ThemedText style={styles.methodTitle} weight="bold">Open Prayer</ThemedText>
                <ThemedText style={styles.methodSubtitle}>A simple, unstructured prayer</ThemedText>
              </View>
            </View>
          )}

          {/* Prayer Input Section */}
          <View style={styles.inputSection}>
            {/* Removed label per request and hide input when no selection */}
            {selectedPrayerType ? (
              <TextInput
                ref={textInputRef}
                style={[styles.prayerInput, { fontFamily: regularFont }]}
                placeholder={
                  selectedPrayerType === 'freeform'
                    ? 'Pray freely from your heart...'
                    : getPlaceholderForPrayerType(selectedPrayerType)
                }
                placeholderTextColor={Colors.textGray}
                value={prayerText}
                onChangeText={onPrayerTextChange}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                autoFocus={true}
                textAlign="left"
                blurOnSubmit={false}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />
            ) : (
              // When nothing is selected, hide input; placeholder text defined for completeness
              <></>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 1000,
    backgroundColor: Colors.anchorBlue,
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  disabledText: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabTextActive: {
    color: Colors.hopeWhite,
  },
  methodSection: {
    gap: 16,
  },
  methodHeader: {
    gap: 4,
    marginBottom: 8,
  },
  methodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  methodSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    opacity: 0.8,
  },
  prayerTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  prayerTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 120,
  },
  prayerTypeButtonSelected: {
    backgroundColor: Colors.growthGreen + '20',
    borderColor: Colors.growthGreen,
  },
  prayerTypeText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
  },
  prayerTypeTextSelected: {
    color: Colors.hopeWhite,
  },
  prayerTypeDescription: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.8,
  },
  inputSection: {
    marginTop: 24,
    gap: 12,
  },
  inputSectionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  prayerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 20,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    lineHeight: 24,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
});
