import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import ThemedText from '../components/common/ThemedText';
import { Logger } from '../utils/ProductionLogger';

/**
 * FamilySettingsScreen
 *
 * Enterprise-grade family subscription settings
 * Features:
 * - Group name management
 * - Member capacity adjustment
 * - Billing cycle changes
 * - Notification preferences
 * - Subscription cancellation
 */

const FamilySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const { familyGroup, isAdmin, refreshFamilyData } = useFamilySubscription();

  const [editingName, setEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(familyGroup?.group_name || '');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    memberJoined: true,
    memberLeft: true,
    usageAlerts: true,
    billingReminders: true,
  });

  const handleSaveGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    try {
      // TODO: Implement group name update API
      Logger.info('Updating group name', { newName: newGroupName });
      setEditingName(false);
      Alert.alert('Success', 'Group name updated successfully');
      await refreshFamilyData();
    } catch (error) {
      Logger.error('Failed to update group name', error as Error, {
        component: 'FamilySettingsScreen',
      });
      Alert.alert('Error', 'Failed to update group name');
    }
  };

  const handleCancelSubscription = () => {
    setShowCancelModal(true);
  };

  const confirmCancellation = async () => {
    try {
      // TODO: Implement subscription cancellation API
      Logger.info('Cancelling family subscription');
      setShowCancelModal(false);
      Alert.alert(
        'Subscription Cancelled',
        'Your family subscription will remain active until the end of the current billing period.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Logger.error('Failed to cancel subscription', error as Error, {
        component: 'FamilySettingsScreen',
      });
      Alert.alert('Error', 'Failed to cancel subscription');
    }
  };

  const handleChangeBillingCycle = () => {
    Alert.alert(
      'Change Billing Cycle',
      'Would you like to switch to annual billing and save 17%?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch to Annual',
          onPress: async () => {
            try {
              // TODO: Implement billing cycle change API
              Logger.info('Changing billing cycle to annual');
              Alert.alert('Success', 'Billing cycle updated. Changes will take effect on your next billing date.');
            } catch (error) {
              Alert.alert('Error', 'Failed to update billing cycle');
            }
          },
        },
      ]
    );
  };

  const handleIncreaseCapacity = () => {
    Alert.alert(
      'Increase Capacity',
      'How many members would you like to add?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '+2 Members',
          onPress: () => processCapacityIncrease(2),
        },
        {
          text: '+5 Members',
          onPress: () => processCapacityIncrease(5),
        },
      ]
    );
  };

  const processCapacityIncrease = async (additionalMembers: number) => {
    try {
      // TODO: Implement capacity increase API
      Logger.info('Increasing capacity', { additionalMembers });
      Alert.alert(
        'Capacity Increased',
        `Your family plan now supports ${(familyGroup?.max_members || 5) + additionalMembers} members.`
      );
      await refreshFamilyData();
    } catch (error) {
      Alert.alert('Error', 'Failed to increase capacity');
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={Colors.textGray} />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            Only family administrators can access settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Family Settings</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Group Information */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Group Information</ThemedText>

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <ThemedText style={styles.settingLabel}>Group Name</ThemedText>
              {!editingName && (
                <TouchableOpacity onPress={() => setEditingName(true)}>
                  <Ionicons name="create-outline" size={20} color={Colors.anchorBlue} />
                </TouchableOpacity>
              )}
            </View>
            {editingName ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.textInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Enter group name"
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      setNewGroupName(familyGroup?.group_name || '');
                      setEditingName(false);
                    }}
                  >
                    <ThemedText style={styles.editButtonText}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButton, styles.editButtonPrimary]}
                    onPress={handleSaveGroupName}
                  >
                    <ThemedText style={styles.editButtonTextPrimary}>Save</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ThemedText style={styles.settingValue}>{familyGroup?.group_name}</ThemedText>
            )}
          </View>

          <View style={styles.settingItem}>
            <ThemedText style={styles.settingLabel}>Member Capacity</ThemedText>
            <View style={styles.capacityRow}>
              <ThemedText style={styles.settingValue}>
                {familyGroup?.current_members} / {familyGroup?.max_members} members
              </ThemedText>
              <TouchableOpacity
                style={styles.increaseButton}
                onPress={handleIncreaseCapacity}
              >
                <Ionicons name="add-circle" size={20} color={Colors.anchorBlue} />
                <ThemedText style={styles.increaseButtonText}>Increase</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Billing */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Billing</ThemedText>

          <TouchableOpacity style={styles.settingItem} onPress={handleChangeBillingCycle}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="calendar" size={24} color={Colors.anchorBlue} />
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>Billing Cycle</ThemedText>
                <ThemedText style={styles.settingValue}>
                  {familyGroup?.billing_cycle === 'annual' ? 'Annual' : 'Monthly'}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textGray} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="card" size={24} color={Colors.anchorBlue} />
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>Next Billing Date</ThemedText>
                <ThemedText style={styles.settingValue}>
                  {familyGroup?.next_billing_date
                    ? new Date(familyGroup.next_billing_date).toLocaleDateString()
                    : 'N/A'}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Member Joined</ThemedText>
              <Switch
                value={notificationSettings.memberJoined}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, memberJoined: value })
                }
                trackColor={{ false: Colors.lightGray, true: Colors.anchorBlue + '50' }}
                thumbColor={notificationSettings.memberJoined ? Colors.anchorBlue : Colors.hopeWhite}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Member Left</ThemedText>
              <Switch
                value={notificationSettings.memberLeft}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, memberLeft: value })
                }
                trackColor={{ false: Colors.lightGray, true: Colors.anchorBlue + '50' }}
                thumbColor={notificationSettings.memberLeft ? Colors.anchorBlue : Colors.hopeWhite}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Usage Alerts</ThemedText>
              <Switch
                value={notificationSettings.usageAlerts}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, usageAlerts: value })
                }
                trackColor={{ false: Colors.lightGray, true: Colors.anchorBlue + '50' }}
                thumbColor={notificationSettings.usageAlerts ? Colors.anchorBlue : Colors.hopeWhite}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Billing Reminders</ThemedText>
              <Switch
                value={notificationSettings.billingReminders}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, billingReminders: value })
                }
                trackColor={{ false: Colors.lightGray, true: Colors.anchorBlue + '50' }}
                thumbColor={notificationSettings.billingReminders ? Colors.anchorBlue : Colors.hopeWhite}
              />
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</ThemedText>

          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleCancelSubscription}
          >
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, styles.dangerIcon]}>
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.dangerLabel}>Cancel Subscription</ThemedText>
                <ThemedText style={styles.dangerDescription}>
                  End your family subscription
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.error} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Cancellation Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCancelModal(false)}>
              <ThemedText style={styles.modalCancel}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>Cancel Subscription</ThemedText>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={48} color={Colors.error} />
              <ThemedText style={styles.warningTitle}>Are you sure?</ThemedText>
              <ThemedText style={styles.warningText}>
                Cancelling your family subscription will:
              </ThemedText>
            </View>

            <View style={styles.consequencesList}>
              <View style={styles.consequenceItem}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
                <ThemedText style={styles.consequenceText}>
                  Remove access for all {familyGroup?.current_members} family members
                </ThemedText>
              </View>
              <View style={styles.consequenceItem}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
                <ThemedText style={styles.consequenceText}>
                  End unlimited playbooks and devotionals
                </ThemedText>
              </View>
              <View style={styles.consequenceItem}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
                <ThemedText style={styles.consequenceText}>
                  Lose family analytics and insights
                </ThemedText>
              </View>
              <View style={styles.consequenceItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
                <ThemedText style={styles.consequenceText}>
                  Remain active until {familyGroup?.subscription_end_date ? new Date(familyGroup.subscription_end_date).toLocaleDateString() : 'end of period'}
                </ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={confirmCancellation}
            >
              <ThemedText style={styles.confirmCancelText}>
                Yes, Cancel Subscription
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keepButton}
              onPress={() => setShowCancelModal(false)}
            >
              <ThemedText style={styles.keepButtonText}>Keep My Subscription</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (fonts: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    sectionTitle: {
      fontSize: 20,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      marginBottom: 16,
    },
    dangerTitle: {
      color: Colors.error,
    },
    settingItem: {
      marginBottom: 16,
    },
    settingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.anchorBlue + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerIcon: {
      backgroundColor: Colors.error + '15',
    },
    settingContent: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginBottom: 4,
    },
    settingValue: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    capacityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    increaseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: Colors.anchorBlue + '15',
    },
    increaseButtonText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    editContainer: {
      marginTop: 8,
    },
    textInput: {
      borderWidth: 2,
      borderColor: Colors.anchorBlue,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.text,
      marginBottom: 12,
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
    },
    editButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.lightGray,
      alignItems: 'center',
    },
    editButtonPrimary: {
      backgroundColor: Colors.anchorBlue,
      borderColor: Colors.anchorBlue,
    },
    editButtonText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.textGray,
    },
    editButtonTextPrimary: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.hopeWhite,
    },
    dangerItem: {
      borderWidth: 1,
      borderColor: Colors.error + '30',
      borderRadius: 12,
      padding: 12,
      backgroundColor: Colors.error + '05',
    },
    dangerLabel: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.error,
      marginBottom: 4,
    },
    dangerDescription: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    errorTitle: {
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    modalCancel: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: Colors.anchorBlue,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.text,
    },
    modalContent: {
      flex: 1,
      padding: 24,
    },
    warningBox: {
      alignItems: 'center',
      marginBottom: 32,
    },
    warningTitle: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: Colors.error,
      marginTop: 16,
      marginBottom: 8,
    },
    warningText: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
    },
    consequencesList: {
      gap: 16,
      marginBottom: 32,
    },
    consequenceItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    consequenceText: {
      flex: 1,
      fontSize: 15,
      fontFamily: fonts.regular,
      color: Colors.text,
      lineHeight: 22,
    },
    confirmCancelButton: {
      backgroundColor: Colors.error,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    confirmCancelText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.hopeWhite,
    },
    keepButton: {
      borderWidth: 2,
      borderColor: Colors.anchorBlue,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    keepButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
  });

export default withErrorBoundary(FamilySettingsScreen, 'FamilySettingsScreen');
