import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../context/IndustryStandardAuthContext';
import { Colors } from '../../theme/colors';

interface Props {
  navigation: any;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  // TODO: Add updatePreferences to IndustryStandardAuthContext
  const [preferences, setPreferences] = useState(user?.preferences || {});

  const handlePreferenceUpdate = async (section: string, key: string, value: any) => {
    const updatedPreferences = {
      ...preferences,
      [section]: {
        ...preferences[section],
        [key]: value,
      },
    };

    setPreferences(updatedPreferences);

    try {
      await updatePreferences(updatedPreferences);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      // Revert the change
      setPreferences(preferences);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'This will permanently delete your account and all associated data.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: () => navigation.navigate('DeleteAccount'),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => ( // eslint-disable-line react/no-unstable-nested-components
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const SettingsRow = ({ // eslint-disable-line react/no-unstable-nested-components
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
    showArrow = true,
    danger = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showArrow?: boolean;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingsRowLeft}>
        <View style={[styles.settingsIcon, danger && styles.dangerIcon]}>
          <Ionicons
            name={icon}
            size={20}
            color={danger ? Colors.error : Colors.primary}
          />
        </View>
        <View style={styles.settingsText}>
          <Text style={[styles.settingsTitle, danger && styles.dangerText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.settingsSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.settingsRowRight}>
        {rightElement}
        {showArrow && onPress && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.gray}
            style={styles.arrowIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const SwitchRow = ({ // eslint-disable-line react/no-unstable-nested-components
    icon,
    title,
    subtitle,
    value,
    onValueChange,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <SettingsRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      showArrow={false}
      rightElement={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#767577', true: Colors.primary + '40' }}
          thumbColor={value ? Colors.primary : '#f4f3f4'}
        />
      }
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <SettingsSection title="Profile">
          <SettingsRow
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsRow
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <SettingsRow
            icon="mail-outline"
            title="Email Verification"
            subtitle={user?.emailVerified ? 'Verified' : 'Not verified'}
            onPress={() => navigation.navigate('EmailVerification')}
          />
        </SettingsSection>

        {/* Notifications Section */}
        <SettingsSection title="Notifications">
          <SwitchRow
            icon="notifications-outline"
            title="Push Notifications"
            subtitle="Receive notifications on your device"
            value={preferences.notifications?.pushEnabled || false}
            onValueChange={(value) => handlePreferenceUpdate('notifications', 'pushEnabled', value)}
          />
          <SwitchRow
            icon="book-outline"
            title="Daily Devotional"
            subtitle="Reminder for daily devotional reading"
            value={preferences.notifications?.dailyDevotional || false}
            onValueChange={(value) => handlePreferenceUpdate('notifications', 'dailyDevotional', value)}
          />
          <SwitchRow
            icon="heart-outline"
            title="Prayer Reminders"
            subtitle="Reminders for prayer time"
            value={preferences.notifications?.prayerReminders || false}
            onValueChange={(value) => handlePreferenceUpdate('notifications', 'prayerReminders', value)}
          />
          <SwitchRow
            icon="journal-outline"
            title="Journal Prompts"
            subtitle="Daily journal writing prompts"
            value={preferences.notifications?.journalPrompts || false}
            onValueChange={(value) => handlePreferenceUpdate('notifications', 'journalPrompts', value)}
          />
          <SwitchRow
            icon="trophy-outline"
            title="Achievements"
            subtitle="Notifications for badges and milestones"
            value={preferences.notifications?.achievements || false}
            onValueChange={(value) => handlePreferenceUpdate('notifications', 'achievements', value)}
          />
          <SettingsRow
            icon="time-outline"
            title="Reminder Time"
            subtitle={preferences.notifications?.reminderTime || '8:00 AM'}
            onPress={() => navigation.navigate('ReminderTime')}
          />
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection title="Appearance">
          <SettingsRow
            icon="moon-outline"
            title="Theme"
            subtitle={preferences.theme === 'dark' ? 'Dark' : preferences.theme === 'light' ? 'Light' : 'System'}
            onPress={() => navigation.navigate('ThemeSettings')}
          />
          <SettingsRow
            icon="text-outline"
            title="Font Size"
            subtitle={preferences.fontSize === 'small' ? 'Small' : preferences.fontSize === 'large' ? 'Large' : preferences.fontSize === 'extra_large' ? 'Extra Large' : 'Medium'}
            onPress={() => navigation.navigate('FontSettings')}
          />
          <SettingsRow
            icon="color-palette-outline"
            title="Color Scheme"
            subtitle={preferences.colorScheme === 'blue' ? 'Blue' : preferences.colorScheme === 'green' ? 'Green' : preferences.colorScheme === 'purple' ? 'Purple' : preferences.colorScheme === 'warm' ? 'Warm' : 'Default'}
            onPress={() => navigation.navigate('ColorSchemeSettings')}
          />
        </SettingsSection>

        {/* Content Section */}
        <SettingsSection title="Content">
          <SettingsRow
            icon="language-outline"
            title="Language"
            subtitle={preferences.content?.language === 'es' ? 'Spanish' : preferences.content?.language === 'fr' ? 'French' : 'English'}
            onPress={() => navigation.navigate('LanguageSettings')}
          />
          <SettingsRow
            icon="library-outline"
            title="Bible Version"
            subtitle={preferences.content?.bibleVersion || 'NIV'}
            onPress={() => navigation.navigate('BibleVersionSettings')}
          />
          <SwitchRow
            icon="play-outline"
            title="Auto-play Audio"
            subtitle="Automatically play audio content"
            value={preferences.content?.autoPlayAudio || false}
            onValueChange={(value) => handlePreferenceUpdate('content', 'autoPlayAudio', value)}
          />
          <SwitchRow
            icon="download-outline"
            title="Download for Offline"
            subtitle="Download content for offline reading"
            value={preferences.content?.downloadForOffline || false}
            onValueChange={(value) => handlePreferenceUpdate('content', 'downloadForOffline', value)}
          />
          <SwitchRow
            icon="sunny-outline"
            title="Verse of the Day"
            subtitle="Show daily verse on home screen"
            value={preferences.content?.showVerseOfDay || false}
            onValueChange={(value) => handlePreferenceUpdate('content', 'showVerseOfDay', value)}
          />
        </SettingsSection>

        {/* Privacy Section */}
        <SettingsSection title="Privacy">
          <SettingsRow
            icon="eye-outline"
            title="Profile Visibility"
            subtitle={preferences.privacy?.profileVisibility === 'public' ? 'Public' : preferences.privacy?.profileVisibility === 'friends' ? 'Friends Only' : 'Private'}
            onPress={() => navigation.navigate('PrivacySettings')}
          />
          <SwitchRow
            icon="bar-chart-outline"
            title="Share Progress"
            subtitle="Allow others to see your progress"
            value={preferences.privacy?.shareProgress || false}
            onValueChange={(value) => handlePreferenceUpdate('privacy', 'shareProgress', value)}
          />
          <SwitchRow
            icon="journal-outline"
            title="Share Journal Entries"
            subtitle="Allow sharing of journal entries"
            value={preferences.privacy?.shareJournal || false}
            onValueChange={(value) => handlePreferenceUpdate('privacy', 'shareJournal', value)}
          />
          <SwitchRow
            icon="people-outline"
            title="Allow Friend Requests"
            subtitle="Let others send you friend requests"
            value={preferences.privacy?.allowFriendRequests || false}
            onValueChange={(value) => handlePreferenceUpdate('privacy', 'allowFriendRequests', value)}
          />
        </SettingsSection>

        {/* Data & Storage Section */}
        <SettingsSection title="Data & Storage">
          <SettingsRow
            icon="cloud-download-outline"
            title="Backup Data"
            subtitle="Backup your data to cloud"
            onPress={() => navigation.navigate('BackupSettings')}
          />
          <SettingsRow
            icon="refresh-outline"
            title="Sync Settings"
            subtitle="Manage data synchronization"
            onPress={() => navigation.navigate('SyncSettings')}
          />
          <SettingsRow
            icon="trash-outline"
            title="Clear Cache"
            subtitle="Clear app cache and temporary files"
            onPress={() => navigation.navigate('ClearCache')}
          />
          <SettingsRow
            icon="download-outline"
            title="Export Data"
            subtitle="Export your data for backup"
            onPress={() => navigation.navigate('ExportData')}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Support">
          <SettingsRow
            icon="help-circle-outline"
            title="Help Center"
            subtitle="Get help and support"
            onPress={() => navigation.navigate('HelpCenter')}
          />
          <SettingsRow
            icon="chatbubble-outline"
            title="Contact Support"
            subtitle="Get in touch with our team"
            onPress={() => navigation.navigate('ContactSupport')}
          />
          <SettingsRow
            icon="star-outline"
            title="Rate App"
            subtitle="Rate us on the App Store"
            onPress={() => navigation.navigate('RateApp')}
          />
          <SettingsRow
            icon="share-outline"
            title="Share App"
            subtitle="Share siFia with friends"
            onPress={() => navigation.navigate('ShareApp')}
          />
        </SettingsSection>

        {/* Legal Section */}
        <SettingsSection title="Legal">
          <SettingsRow
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Read our terms and conditions"
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <SettingsRow
            icon="shield-outline"
            title="Privacy Policy"
            subtitle="Read our privacy policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <SettingsRow
            icon="information-circle-outline"
            title="About"
            subtitle="App version and information"
            onPress={() => navigation.navigate('About')}
          />
        </SettingsSection>

        {/* Account Actions Section */}
        <SettingsSection title="Account">
          <SettingsRow
            icon="log-out-outline"
            title="Sign Out"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            showArrow={false}
          />
          <SettingsRow
            icon="trash-outline"
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
            showArrow={false}
            danger={true}
          />
        </SettingsSection>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>siFia v1.0.0</Text>
          <Text style={styles.versionSubtext}>© 2024 siFia. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: Colors.error + '10',
  },
  settingsText: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  dangerText: {
    color: Colors.error,
  },
  settingsSubtitle: {
    fontSize: 14,
    color: Colors.gray,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  versionText: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 4,
  },
  versionSubtext: {
    fontSize: 12,
    color: Colors.gray,
    textAlign: 'center',
  },
});

export default SettingsScreen;
