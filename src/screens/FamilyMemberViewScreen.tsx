import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';

/**
 * FamilyMemberViewScreen
 *
 * View for non-admin family members
 * Features:
 * - View family group info
 * - See other members
 * - View own usage stats
 * - Leave family option
 */

const FamilyMemberViewScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const {
    familyGroup,
    loading,
    error,
    refreshFamilyData,
    getFamilyUsageAnalytics,
  } = useFamilySubscription();

  const [refreshing, setRefreshing] = useState(false);
  const [myUsage, setMyUsage] = useState<any>(null);

  const loadMyUsage = useCallback(async () => {
    try {
      const analytics = await getFamilyUsageAnalytics();
      const myStats = analytics?.memberUsage?.find((m: any) => m.userId === user?.id);
      setMyUsage(myStats);
    } catch (err) {
      console.error('Failed to load usage:', err);
    }
  }, [getFamilyUsageAnalytics, user?.id]);

  React.useEffect(() => {
    if (familyGroup && user?.id) {
      loadMyUsage();
    }
  }, [familyGroup, user?.id, loadMyUsage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFamilyData();
    await loadMyUsage();
    setRefreshing(false);
  };

  const handleLeaveFamily = () => {
    Alert.alert(
      'Leave Family?',
      'Are you sure you want to leave this family subscription? You will lose access to unlimited features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement leave family API
              Alert.alert(
                'Left Family',
                'You have left the family subscription. Your account has been downgraded to the free tier.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('MainTabs' as never),
                  },
                ]
              );
            } catch (err) {
              Alert.alert('Error', 'Failed to leave family');
            }
          },
        },
      ]
    );
  };

  const adminMember = familyGroup?.members?.find(m => m.role === 'admin');

  if (loading && !familyGroup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading family info...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!familyGroup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="people-outline" size={64} color={Colors.textGray} />
          <ThemedText style={styles.errorTitle}>No Family Group</ThemedText>
          <ThemedText style={styles.errorText}>
            You are not part of a family subscription.
          </ThemedText>
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
        <ThemedText style={styles.headerTitle}>My Family</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Family Group Card */}
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={32} color={Colors.anchorBlue} />
          </View>
          <ThemedText style={styles.groupName}>{familyGroup.group_name}</ThemedText>
          <View style={styles.memberCount}>
            <Ionicons name="people-outline" size={16} color={Colors.textGray} />
            <ThemedText style={styles.memberCountText}>
              {familyGroup.current_members} / {familyGroup.max_members} members
            </ThemedText>
          </View>
        </View>

        {/* My Usage Stats */}
        {myUsage && (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>My Usage This Month</ThemedText>
            <View style={styles.usageGrid}>
              <View style={styles.usageItem}>
                <View style={[styles.usageIcon, { backgroundColor: Colors.playbookBlue + '20' }]}>
                  <Ionicons name="book" size={24} color={Colors.playbookBlue} />
                </View>
                <ThemedText style={styles.usageValue}>{myUsage.playbooks}</ThemedText>
                <ThemedText style={styles.usageLabel}>Playbooks</ThemedText>
              </View>
              <View style={styles.usageItem}>
                <View style={[styles.usageIcon, { backgroundColor: Colors.devotionalPurple + '20' }]}>
                  <Ionicons name="heart" size={24} color={Colors.devotionalPurple} />
                </View>
                <ThemedText style={styles.usageValue}>{myUsage.devotionals}</ThemedText>
                <ThemedText style={styles.usageLabel}>Devotionals</ThemedText>
              </View>
            </View>
            <View style={styles.unlimitedBadge}>
              <Ionicons name="infinite" size={20} color={Colors.anchorBlue} />
              <ThemedText style={styles.unlimitedText}>Unlimited Access</ThemedText>
            </View>
          </View>
        )}

        {/* Family Members */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Family Members</ThemedText>
          {familyGroup.members?.map((member) => (
            <View key={member.user_id} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <ThemedText style={styles.memberInitial}>
                  {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.memberDetails}>
                <View style={styles.memberNameRow}>
                  <ThemedText style={styles.memberName}>
                    {member.full_name || member.email}
                  </ThemedText>
                  {member.role === 'admin' && (
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark" size={12} color={Colors.anchorBlue} />
                      <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
                    </View>
                  )}
                  {member.user_id === user?.id && (
                    <View style={styles.youBadge}>
                      <ThemedText style={styles.youBadgeText}>You</ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={styles.memberEmail}>{member.email}</ThemedText>
              </View>
            </View>
          ))}
        </View>

        {/* Admin Info */}
        {adminMember && (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Family Administrator</ThemedText>
            <View style={styles.adminInfo}>
              <View style={styles.adminAvatar}>
                <Ionicons name="shield-checkmark" size={24} color={Colors.anchorBlue} />
              </View>
              <View style={styles.adminDetails}>
                <ThemedText style={styles.adminName}>
                  {adminMember.full_name || adminMember.email}
                </ThemedText>
                <ThemedText style={styles.adminDescription}>
                  Manages members and billing
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Benefits */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Your Benefits</ThemedText>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Unlimited playbooks & devotionals</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Smart journaling enabled</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Priority support</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <ThemedText style={styles.benefitText}>Calendar sync</ThemedText>
          </View>
        </View>

        {/* Leave Family */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveFamily}>
            <Ionicons name="exit-outline" size={20} color={Colors.error} />
            <ThemedText style={styles.leaveButtonText}>Leave Family</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.leaveNote}>
            If you leave, you'll lose access to unlimited features and be downgraded to the free tier.
          </ThemedText>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <ThemedText style={styles.errorBannerText}>{error}</ThemedText>
          </View>
        )}
      </ScrollView>
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
    card: {
      backgroundColor: Colors.hopeWhite,
      marginHorizontal: 20,
      marginVertical: 8,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: Colors.anchorBlue + '15',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 16,
    },
    groupName: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      textAlign: 'center',
      marginBottom: 8,
    },
    memberCount: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    memberCountText: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    cardTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
      marginBottom: 16,
    },
    usageGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    usageItem: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      backgroundColor: Colors.lightGray,
      borderRadius: 12,
    },
    usageIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    usageValue: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: Colors.text,
      marginBottom: 4,
    },
    usageLabel: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    unlimitedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.anchorBlue + '15',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      gap: 6,
    },
    unlimitedText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.anchorBlue,
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
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    memberName: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: Colors.text,
    },
    adminBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.anchorBlue + '15',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      gap: 4,
    },
    adminBadgeText: {
      fontSize: 10,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    youBadge: {
      backgroundColor: Colors.faithGold + '20',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    youBadgeText: {
      fontSize: 10,
      fontFamily: fonts.semiBold,
      color: Colors.faithGold,
    },
    memberEmail: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    adminInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.anchorBlue + '10',
      borderRadius: 12,
      padding: 16,
    },
    adminAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.anchorBlue + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    adminDetails: {
      flex: 1,
    },
    adminName: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
      marginBottom: 4,
    },
    adminDescription: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    benefitText: {
      flex: 1,
      fontSize: 15,
      fontFamily: fonts.regular,
      color: Colors.text,
    },
    leaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.error,
      backgroundColor: Colors.error + '10',
      marginBottom: 12,
    },
    leaveButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.error,
    },
    leaveNote: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
      lineHeight: 18,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 16,
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
  });

export default withErrorBoundary(FamilyMemberViewScreen, 'FamilyMemberViewScreen');
