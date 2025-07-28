import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import { LinearGradient } from 'expo-linear-gradient'; // Temporarily disabled
import { useAuth } from '../context/IndustryStandardAuthContext';
import { userApi } from '../services/userApi';
import { UserProgress, Badge, UserPreferences } from '../types/auth';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

interface ProfileStats {
  faithPoints: number;
  level: number;
  totalBadges: number;
  currentStreak: number;
  goalsCompleted: number;
  devotionalsFinished: number;
  prayerSessions: number;
  journalEntries: number;
}

const UserProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut, updateProfile, updatePreferences } = useAuth();
  // TODO: Add updateProfile and updatePreferences to IndustryStandardAuthContext
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [recentBadges, setRecentBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [badgesModal, setBadgesModal] = useState(false);
  
  // Form states
  const [profileForm, setProfileForm] = useState({
    full_name: (user as any)?.user_metadata?.full_name || '',
    bio: (user as any)?.user_metadata?.bio || '',
    location: (user as any)?.user_metadata?.location || '',
  });
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      dailyDevotional: true,
      prayerReminders: true,
      journalPrompts: true,
      playbookUpdates: true,
      achievements: true,
      weeklyReports: true,
      pushEnabled: true,
      emailEnabled: true,
      reminderTime: '08:00',
      timezone: 'UTC',
    },
    theme: 'light',
    fontSize: 'medium',
    colorScheme: 'default',
    privacy: {
      profileVisibility: 'public',
      shareProgress: true,
      shareJournal: false,
    },
    content: {
      language: 'en',
      bibleVersion: 'NIV',
      autoPlayAudio: false,
      downloadForOffline: false,
      showVerseOfDay: true,
    },
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  // Sync profile form with user metadata
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: (user as any)?.user_metadata?.full_name || '',
        bio: (user as any)?.user_metadata?.bio || '',
        location: (user as any)?.user_metadata?.location || '',
      });
      
      // Load preferences from user metadata if available
      const userPreferences = (user as any)?.user_metadata?.preferences;
      if (userPreferences) {
        setPreferences(prev => ({ ...prev, ...userPreferences }));
      }
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Load user progress and stats
      const progressResponse = await userApi.getUserProgress(user?.id || '');
      if (progressResponse.success && progressResponse.data) {
        setUserProgress(progressResponse.data);
      }
      
      // Load profile statistics
      const statsResponse = await userApi.getProfileStats(user?.id || '');
      if (statsResponse.success && statsResponse.data) {
        setProfileStats(statsResponse.data);
      }
      
      // Load recent badges
      const badgesResponse = await userApi.getRecentBadges(user?.id || '', 5);
      if (badgesResponse.success && badgesResponse.data) {
        setRecentBadges(badgesResponse.data);
      }
      
      // TODO: Load user preferences from separate API or user_metadata
      // Supabase User doesn't have preferences property by default
      // Will need to implement separate preferences loading
      
    } catch (error) {
      console.error('Failed to load profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const handleUpdateProfile = async () => {
    try {
      const result = await updateProfile(profileForm);
      if (result.success) {
        setEditProfileModal(false);
        Alert.alert('Success', 'Profile updated successfully');
        // Reload profile data to reflect changes
        await loadProfileData();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      const result = await updatePreferences(preferences);
      if (result.success) {
        setSettingsModal(false);
        Alert.alert('Success', 'Preferences updated successfully');
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update preferences');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // Navigation will be handled automatically by auth state change
          }
        },
      ]
    );
  };

  const getLevelProgress = () => {
    if (!profileStats) return 0;
    const currentLevelPoints = profileStats.level * 1000;
    const nextLevelPoints = (profileStats.level + 1) * 1000;
    const progress = (profileStats.faithPoints - currentLevelPoints) / (nextLevelPoints - currentLevelPoints);
    return Math.max(0, Math.min(1, progress));
  };

  const renderProfileHeader = () => (
    <View style={styles.headerGradient}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {(user as any)?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: (user as any).user_metadata.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
          )}
          <TouchableOpacity style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{(user as any)?.user_metadata?.full_name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {(user as any)?.user_metadata?.bio && <Text style={styles.userBio}>{(user as any).user_metadata.bio}</Text>}
          
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Level {profileStats?.level || 1}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${getLevelProgress() * 100}%` }]} 
              />
            </View>
            <Text style={styles.faithPointsText}>
              {profileStats?.faithPoints || 0} FaithPoints
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setEditProfileModal(true)}
        >
          <Ionicons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStatsGrid = () => (
    <View style={styles.statsContainer}>
      <Text style={styles.sectionTitle}>Your Journey</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={24} color={Colors.primary} />
          <Text style={styles.statNumber}>{profileStats?.totalBadges || 0}</Text>
          <Text style={styles.statLabel}>Badges</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="flame" size={24} color={Colors.faithGold} />
          <Text style={styles.statNumber}>{profileStats?.currentStreak || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          <Text style={styles.statNumber}>{profileStats?.goalsCompleted || 0}</Text>
          <Text style={styles.statLabel}>Goals</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="book" size={24} color={Colors.devotionalPurple} />
          <Text style={styles.statNumber}>{profileStats?.devotionalsFinished || 0}</Text>
          <Text style={styles.statLabel}>Devotionals</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="heart" size={24} color={Colors.error} />
          <Text style={styles.statNumber}>{profileStats?.prayerSessions || 0}</Text>
          <Text style={styles.statLabel}>Prayers</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="journal" size={24} color={Colors.warning} />
          <Text style={styles.statNumber}>{profileStats?.journalEntries || 0}</Text>
          <Text style={styles.statLabel}>Journal</Text>
        </View>
      </View>
    </View>
  );

  const renderRecentBadges = () => (
    <View style={styles.badgesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Badges</Text>
        <TouchableOpacity onPress={() => setBadgesModal(true)}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.badgesList}>
          {recentBadges.map((badge, index) => (
            <View key={index} style={styles.badgeItem}>
              <View style={styles.badgeIcon}>
                <Text style={styles.badgeEmoji}>{badge.icon}</Text>
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgePoints}>+{(badge as any).faith_points_reward || 0}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderMenuOptions = () => (
    <View style={styles.menuContainer}>
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => Alert.alert('Coming Soon', 'Goals feature is coming soon!')}
      >
        <Ionicons name="flag" size={24} color={Colors.primary} />
        <Text style={styles.menuText}>My Goals</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => Alert.alert('Coming Soon', 'Challenges feature is coming soon!')}
      >
        <Ionicons name="trophy" size={24} color={Colors.faithGold} />
        <Text style={styles.menuText}>Challenges</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => setBadgesModal(true)}
      >
        <Ionicons name="medal" size={24} color={Colors.success} />
        <Text style={styles.menuText}>All Badges</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => setSettingsModal(true)}
      >
        <Ionicons name="settings" size={24} color={Colors.mediumGray} />
        <Text style={styles.menuText}>Settings</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.menuItem, styles.logoutItem]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out" size={24} color={Colors.error} />
        <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  const renderEditProfileModal = () => (
    <Modal
      visible={editProfileModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setEditProfileModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleUpdateProfile}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={profileForm.full_name}
              onChangeText={(text) => setProfileForm({ ...profileForm, full_name: text })}
              placeholder="Enter your full name"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profileForm.bio}
              onChangeText={(text) => setProfileForm({ ...profileForm, bio: text })}
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={3}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={profileForm.location}
              onChangeText={(text) => setProfileForm({ ...profileForm, location: text })}
              placeholder="Your location"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={settingsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setSettingsModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Settings</Text>
          <TouchableOpacity onPress={handleUpdatePreferences}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Notifications</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Switch
                value={preferences.notifications.pushEnabled}
                onValueChange={(value) => 
                  setPreferences({ 
                    ...preferences, 
                    notifications: { ...preferences.notifications, pushEnabled: value }
                  })
                }
              />
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Switch
                value={preferences.notifications.emailEnabled}
                onValueChange={(value) => 
                  setPreferences({ 
                    ...preferences, 
                    notifications: { ...preferences.notifications, emailEnabled: value }
                  })
                }
              />
            </View>
          </View>
          
          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Privacy</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Profile Visibility</Text>
              <Text style={styles.settingValue}>{preferences.privacy.profileVisibility}</Text>
            </View>
          </View>
          
          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>Appearance</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Theme</Text>
              <Text style={styles.settingValue}>{preferences.theme}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderProfileHeader()}
        {renderStatsGrid()}
        {renderRecentBadges()}
        {renderMenuOptions()}
      </ScrollView>
      
      {renderEditProfileModal()}
      {renderSettingsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 20,
    backgroundColor: Colors.anchorBlue,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  defaultAvatar: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  levelContainer: {
    marginTop: 8,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  faithPointsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  editButton: {
    padding: 8,
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 60) / 3,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  badgesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  badgesList: {
    flexDirection: 'row',
  },
  badgeItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  badgePoints: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '500',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: Colors.error,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.mediumGray,
  },
  saveText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  settingValue: {
    fontSize: 16,
    color: Colors.mediumGray,
    textTransform: 'capitalize',
  },
});

export default UserProfileScreen;
