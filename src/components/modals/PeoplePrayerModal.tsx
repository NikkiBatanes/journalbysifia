import React, { useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerSelectionHaptic } from '../../utils/haptics';
import { getFontFamily, DEFAULT_FONT_FAMILY } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

interface PeoplePrayerModalProps {
  visible: boolean;
  selectedPrayerType: string;
  name: string;
  prayerText: string;
  notes: string;
  onSelectPrayerType: (type: string) => void;
  onNameChange: (text: string) => void;
  onPrayerTextChange: (text: string) => void;
  onNotesChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  currentRequestedBy?: string;
}

export const PeoplePrayerModal: React.FC<PeoplePrayerModalProps> = ({
  visible,
  selectedPrayerType,
  name,
  prayerText,
  notes,
  onSelectPrayerType,
  onNameChange,
  onPrayerTextChange,
  onNotesChange,
  onSave,
  onCancel,
  isSaving = false,
  currentRequestedBy,
}) => {
  // Ensure placeholders default to Personal/Mine on initial open
  const effectiveType = selectedPrayerType || 'mine';
  const [activeTab, setActiveTab] = useState<'Personal' | 'Requests'>('Personal');
  const theme = useTheme();
  const regularFont = getFontFamily(theme.currentFont || DEFAULT_FONT_FAMILY, 'regular');
  const nameInputRef = useRef<TextInput>(null);
  const prayerInputRef = useRef<TextInput>(null);
  const prevVisibleRef = useRef(false);
  const latestNameRef = useRef(name);

  React.useEffect(() => {
    latestNameRef.current = name;
  }, [name]);

  // Handle tab change and align selected type
  const handleTabChange = useCallback((tab: 'Personal' | 'Requests') => {
    setActiveTab(prev => {
      if (prev !== tab) {
        triggerSelectionHaptic();
      }
      return tab;
    });
    if (tab === 'Requests') {
      onSelectPrayerType('requests');
    } else if (tab === 'Personal') {
      onSelectPrayerType('mine');
    }

    // Focus the name input after tab change
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 150);
  }, [onSelectPrayerType]);

  // Helper function to get placeholder text
  const getPlaceholderForType = (type: string) => {
    switch (type) {
      case 'mine':
        return 'What would you like to pray for them?';
      case 'requests':
        return 'What is the prayer request?';
      default:
        return 'Enter your prayer...';
    }
  };

  const getNamePlaceholder = (type: string) => {
    switch (type) {
      case 'mine':
        return 'Who are you praying for?';
      case 'requests':
        return 'Who is requesting prayer?';
      default:
        return 'Enter name...';
    }
  };

  // Reset tab when modal opens and handle focus once
  React.useEffect(() => {
    const wasVisible = prevVisibleRef.current;

    if (visible && !wasVisible) {
      if (selectedPrayerType === 'requests') {
        setActiveTab('Requests');
      } else if (selectedPrayerType === 'mine') {
        setActiveTab('Personal');
      } else {
        setActiveTab('Personal');
        onSelectPrayerType('mine');
      }

      setTimeout(() => {
        if (latestNameRef.current.trim()) {
          prayerInputRef.current?.focus();
        } else {
          nameInputRef.current?.focus();
        }
      }, 150);
    }

    prevVisibleRef.current = visible;
  }, [visible, selectedPrayerType, onSelectPrayerType]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, IS_IPAD && styles.headerPad]}>
          <TouchableOpacity
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <ThemedText style={styles.headerButtonText} weight="medium">Cancel</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle} weight="semiBold">
            Add to Prayer List
          </ThemedText>

          <TouchableOpacity
            onPress={onSave}
            disabled={!name.trim() || !prayerText.trim() || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save Prayer"
          >
            <ThemedText style={[styles.headerButtonText, (!name.trim() || !prayerText.trim() || isSaving) && styles.disabledText]} weight="medium">Save</ThemedText>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={[styles.content, IS_IPAD && styles.contentPad]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'Personal' && styles.tabButtonActive]}
              onPress={() => handleTabChange('Personal')}
              accessibilityRole="tab"
              accessibilityLabel="Prayers for People"
              accessibilityState={{ selected: activeTab === 'Personal' }}
            >
              <ThemedText style={[styles.tabText, activeTab === 'Personal' && styles.tabTextActive]} weight="semiBold">
                Prayers for People
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'Requests' && styles.tabButtonActive]}
              onPress={() => handleTabChange('Requests')}
              accessibilityRole="tab"
              accessibilityLabel="Prayer Requests"
              accessibilityState={{ selected: activeTab === 'Requests' }}
            >
              <ThemedText style={[styles.tabText, activeTab === 'Requests' && styles.tabTextActive]} weight="semiBold">
                Prayer Requests
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Method Description */}
          <View style={styles.methodSection}>
            <View style={styles.methodHeader}>
              <ThemedText style={styles.methodTitle} weight="bold">
                {activeTab === 'Personal' ? 'Prayers for People' : 'Prayer Requests'}
              </ThemedText>
              <ThemedText style={styles.methodSubtitle}>
                {activeTab === 'Personal' ? 'Pray for someone you care about' : 'Add prayer requests from others'}
              </ThemedText>
            </View>
          </View>

          {/* Name Input Section (no label, use placeholder) */}
          <View style={styles.inputSection}>
            <TextInput
              ref={nameInputRef}
              style={[styles.nameInput, { fontFamily: regularFont }]}
              placeholder={getNamePlaceholder(effectiveType)}
              placeholderTextColor={Colors.textGray}
              value={name}
              onChangeText={onNameChange}
              autoCapitalize="words"
              textAlignVertical="center"
              textAlign="left"
            />
          </View>

          {/* Prayer Input Section (no label, use placeholder) */}
          <View style={styles.inputSection}>
            <TextInput
              ref={prayerInputRef}
              style={[styles.prayerInput, { fontFamily: regularFont }]}
              placeholder={getPlaceholderForType(effectiveType)}
              placeholderTextColor={Colors.textGray}
              value={prayerText}
              onChangeText={onPrayerTextChange}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              textAlign="left"
            />
          </View>

          {/* Notes Input Section - Only for Personal Prayers */}
          {selectedPrayerType === 'mine' && (
            <View style={styles.inputSection}>
              <ThemedText style={styles.inputSectionTitle} weight="semiBold">
                {currentRequestedBy ? 'Prayer Request: ' : 'Notes (optional)'}
              </ThemedText>
              <TextInput
                style={[styles.notesInput, { fontFamily: regularFont }]}
                placeholder="Add any additional notes here..."
                placeholderTextColor={Colors.textGray}
                value={notes}
                onChangeText={onNotesChange}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                textAlign="left"
              />
            </View>
          )}

        </ScrollView>
        </KeyboardAvoidingView>
      </View>
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
  },
  headerPad: {
    paddingHorizontal: 160,
  },
  headerButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  disabledText: {
    opacity: 0.5,
  },
  keyboardContainer: {
    flex: 1,
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
  contentPad: {
    paddingHorizontal: 160,
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
  inputSection: {
    marginTop: 24,
    gap: 12,
  },
  inputSectionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    color: Colors.hopeWhite,
    fontSize: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  prayerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 16,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    lineHeight: 24,
  },
  notesInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 16,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    lineHeight: 24,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
});
