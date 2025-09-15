/**
 * Delete TimeBlock Modal with Series Options
 * Handles deletion of single events vs recurring series
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/colors';
import ThemedText from './common/ThemedText';
import { triggerLightHaptic, triggerSelectionHaptic } from '../utils/haptics';

export interface DeleteOptions {
  type: 'single' | 'future' | 'all';
  date?: Date;
}

interface DeleteTimeBlockModalProps {
  visible: boolean;
  isRecurring: boolean;
  eventDate: Date;
  eventTitle: string;
  onDelete: (options: DeleteOptions) => void;
  onCancel: () => void;
  canDeleteSeries: boolean; // Feature gating
}

export const DeleteTimeBlockModal: React.FC<DeleteTimeBlockModalProps> = ({
  visible,
  isRecurring,
  eventDate,
  eventTitle,
  onDelete,
  onCancel,
  canDeleteSeries,
}) => {
  console.log('🗑️ DeleteTimeBlockModal render - visible:', visible, 'eventTitle:', eventTitle);
  const handleDeleteOption = (type: DeleteOptions['type']) => {
    triggerSelectionHaptic();
    onDelete({
      type,
      date: eventDate,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="trash-outline" size={24} color={Colors.alertCoral} />
            </View>
            <ThemedText weight="semiBold" style={styles.title}>
              Delete Time Block
            </ThemedText>
            <ThemedText style={styles.subtitle} numberOfLines={2}>
              "{eventTitle}"
            </ThemedText>
          </View>

          {/* Warning */}
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.alertCoral} style={styles.warningIcon} />
            <ThemedText style={styles.warningText}>Warning: This action cannot be undone.</ThemedText>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {isRecurring && canDeleteSeries ? (
              // Recurring event with two options only
              <>
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleDeleteOption('single')}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionIcon}>
                      <Ionicons name="calendar-outline" size={20} color={Colors.hopeWhite} />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText weight="medium" style={styles.optionTitle}>
                        This Time Block only
                      </ThemedText>
                      <ThemedText style={styles.optionDescription}>
                        Delete only on {formatDate(eventDate)}
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleDeleteOption('future')}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionIcon}>
                      <Ionicons name="calendar-clear-outline" size={20} color={Colors.hopeWhite} />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText weight="medium" style={styles.optionTitle}>
                        This & Future Events
                      </ThemedText>
                      <ThemedText style={styles.optionDescription}>
                        Delete from {formatDate(eventDate)} onwards
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              </>
            ) : isRecurring && !canDeleteSeries ? (
              // Recurring event but no series delete permission (Seeker tier)
              <>
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleDeleteOption('single')}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionIcon}>
                      <Ionicons name="calendar-outline" size={20} color={Colors.hopeWhite} />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText weight="medium" style={styles.optionTitle}>
                        This Time Block only
                      </ThemedText>
                      <ThemedText style={styles.optionDescription}>
                        Delete only on {formatDate(eventDate)}
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Locked future deletion option for Seeker tier (upgrade prompt) */}
                <View style={[styles.option, styles.lockedOption]}>
                  <View style={styles.optionContent}>
                    <View style={styles.optionIcon}>
                      <MaterialCommunityIcons name="lock" size={20} color={Colors.mediumGray} />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText weight="medium" style={[styles.optionTitle, styles.lockedText]}>
                        This & Future Events
                      </ThemedText>
                      <ThemedText style={[styles.optionDescription, styles.lockedText]}>
                        Upgrade to delete this and all future events in the series
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              // Single event
              <TouchableOpacity
                style={styles.option}
                onPress={() => handleDeleteOption('single')}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionIcon}>
                    <Ionicons name="trash-outline" size={20} color={Colors.alertCoral} />
                  </View>
                  <View style={styles.optionText}>
                    <ThemedText weight="medium" style={styles.optionTitle}>
                      Delete Time Block
                    </ThemedText>
                    <ThemedText style={styles.optionDescription}>
                      This action cannot be undone
                    </ThemedText>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              triggerLightHaptic();
              onCancel();
            }}
            activeOpacity={0.7}
          >
            <ThemedText weight="medium" style={styles.cancelText}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  warningIcon: {
    marginRight: 8,
  },
  warningText: {
    color: Colors.hopeWhite,
    fontSize: 13,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  lockedOption: {
    opacity: 0.6,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.mediumGray,
    lineHeight: 18,
  },
  lockedText: {
    color: Colors.mediumGray,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelText: {
    fontSize: 16,
    color: Colors.alertCoral,
  },
});
