import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Logger } from '../utils/ProductionLogger';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import { FamilyMember, FamilyInvitation } from '../services/FamilySubscriptionService';

const FamilyAdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation();

  // Theme integration
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  // Create dynamic fonts object
  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  // Memoize styles with dynamic fonts
  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const {
    familyGroup,
    pendingInvitations,
    error,
    inviteMember,
    removeMember,
    cancelInvitation,
    isAdmin,
    canInviteMembers,
    getFamilyUsageAnalytics,
  } = useFamilySubscription();

  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [usageAnalytics, setUsageAnalytics] = useState<any>(null);

  const loadUsageAnalytics = useCallback(async () => {
    try {
      const analytics = await getFamilyUsageAnalytics();
      setUsageAnalytics(analytics);
    } catch (err) {
      Logger.error('Error loading usage analytics', err as Error, { component: 'FamilyAdminDashboardScreen' });
    }
  }, [getFamilyUsageAnalytics]);

  useEffect(() => {
    if (familyGroup && isAdmin) {
      loadUsageAnalytics();
    }
  }, [familyGroup, isAdmin, loadUsageAnalytics]);

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      const success = await inviteMember(inviteEmail);
      if (success) {
        setInviteEmail('');
        setShowInviteModal(false);
        Alert.alert('Success', 'Invitation sent successfully!');
      }
    } catch (err) {
      Alert.alert('Invite not sent', err instanceof Error ? err.message : 'Failed to send invitation');
    }
  };

  const handleRemoveMember = (member: FamilyMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.full_name || member.email} from the family group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await removeMember(member.user_id);
              if (success) {
                Alert.alert('Success', 'Member removed successfully');
              }
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleCancelInvitation = (invitation: FamilyInvitation) => {
    Alert.alert(
      'Cancel Invitation',
      `Cancel invitation to ${invitation.invited_email}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const success = await cancelInvitation(invitation.id);
              if (success) {
                Alert.alert('Success', 'Invitation cancelled');
              }
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel invitation');
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={Colors.textGray} />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>Only family administrators can access this screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Remove blocking loading state - let ScrollView handle refresh instead

  if (!familyGroup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="people-outline" size={64} color={Colors.textGray} />
          <Text style={styles.errorTitle}>No Family Group</Text>
          <Text style={styles.errorText}>You don't have a family subscription group.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Family Dashboard</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Family Group Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Family Group</Text>
          <View style={styles.groupStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{familyGroup.current_members}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{familyGroup.max_members}</Text>
              <Text style={styles.statLabel}>Max</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{pendingInvitations.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Usage Analytics */}
        {usageAnalytics && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Family Usage</Text>
            <View style={styles.usageStats}>
              <View style={styles.usageItem}>
                <Text style={styles.usageNumber}>{usageAnalytics.totalPlaybooks}</Text>
                <Text style={styles.usageLabel}>Total Playbooks</Text>
              </View>
              <View style={styles.usageItem}>
                <Text style={styles.usageNumber}>{usageAnalytics.totalDevotionals}</Text>
                <Text style={styles.usageLabel}>Total Devotionals</Text>
              </View>
            </View>
          </View>
        )}

        {/* Members List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Family Members</Text>
            {canInviteMembers && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => setShowInviteModal(true)}
              >
                <Ionicons name="person-add" size={20} color={Colors.hopeWhite} />
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>

          {familyGroup.members.map((member) => (
            <View key={member.user_id} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>
                    {member.full_name || member.email}
                  </Text>
                  <Text style={styles.memberRole}>
                    {member.role === 'admin' ? 'Administrator' : 'Member'}
                  </Text>
                  {usageAnalytics && (
                    <Text style={styles.memberUsage}>
                      {usageAnalytics.memberUsage.find((u: any) => u.userId === member.user_id)?.playbooks || 0} playbooks, {' '}
                      {usageAnalytics.memberUsage.find((u: any) => u.userId === member.user_id)?.devotionals || 0} devotionals
                    </Text>
                  )}
                </View>
              </View>
              {member.role !== 'admin' && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveMember(member)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pending Invitations</Text>
            {pendingInvitations.map((invitation) => {
              const createdAt = new Date(invitation.created_at);
              const today = new Date();
              const isToday = createdAt.toDateString() === today.toDateString();
              const formattedDate = createdAt.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <View key={invitation.id} style={styles.invitationItem}>
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationEmail}>{invitation.invited_email}</Text>
                    {!isToday && (
                      <Text style={styles.invitationDate}>
                        Sent {formattedDate}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelInvitation(invitation)}
                  >
                    <Ionicons name="close-circle" size={24} color={Colors.alertCoral} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invite Member</Text>
            <TouchableOpacity onPress={handleInviteMember}>
              <Text style={styles.modalSend}>Send</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.emailInput}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Enter email address"
              placeholderTextColor="rgba(255,255,255,0.6)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inviteNote}>
              The invited person will receive an in-app notification to join your family group.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (fonts: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue, // Main background
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContent: {
    paddingBottom: 24,
    backgroundColor: Colors.anchorBlue,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.anchorBlue,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  placeholder: {
    width: 40,
  },
  card: {
    backgroundColor: '#274674', // Match Truth in Love card container
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 20,
    borderRadius: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  usageItem: {
    alignItems: 'center',
  },
  usageNumber: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  usageLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginTop: 4,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    marginLeft: 4,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitial: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: Colors.hopeWhite,
  },
  memberRole: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginTop: 2,
  },
  memberUsage: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  invitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: Colors.hopeWhite,
  },
  invitationDate: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginTop: 2,
  },
  invitationCode: {
    fontSize: 12,
    color: Colors.alertCoral,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  cancelButton: {
    padding: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: Colors.anchorBlue,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.anchorBlue,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  errorBanner: {
    backgroundColor: Colors.error,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
  },
  errorBannerText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  modalSend: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    color: Colors.hopeWhite,
    backgroundColor: '#274674',
  },
  inviteNote: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    opacity: 0.85,
  },
});

export default withErrorBoundary(FamilyAdminDashboardScreen, 'FamilyAdminDashboardScreen');
