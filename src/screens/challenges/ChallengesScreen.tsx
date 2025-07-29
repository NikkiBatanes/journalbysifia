import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  // Dimensions, // Unused
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
// import { useAuth } from '../../context/IndustryStandardAuthContext'; // Unused
import { userApi } from '../../services/userApi';
import { Challenge } from '../../types/auth';
import { Colors } from '../../theme/colors';

// const { width: _width } = Dimensions.get('window'); // Unused

interface Props {
  navigation: any;
}

const ChallengesScreen: React.FC<Props> = ({ navigation }) => {
  // const { user: _user } = useAuth(); // Unused
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'joined'>('available');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const response = await userApi.getAvailableChallenges();
      if (response.success && response.data) {
        setChallenges(response.data);
      }
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  };

  const handleJoinChallenge = async (_challengeId: string) => {
    try {
      const response = await userApi.joinChallenge('', _challengeId);
      if (response.success) {
        Alert.alert(
          'Challenge Joined!',
          'You have successfully joined the challenge. Good luck!',
          [{ text: 'OK' }]
        );
        // Refresh challenges to update joined status
        await loadChallenges();
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to join challenge');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join challenge. Please try again.');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#27AE60';
      case 'medium': return '#F39C12';
      case 'hard': return '#E74C3C';
      case 'expert': return '#8E44AD';
      default: return Colors.primary;
    }
  };

  const getDifficultyGradient = (difficulty: string): readonly [string, string] => {
    switch (difficulty) {
      case 'easy': return ['#27AE60', '#2ECC71'] as const;
      case 'medium': return ['#F39C12', '#F1C40F'] as const;
      case 'hard': return ['#E74C3C', '#E67E22'] as const;
      case 'expert': return ['#8E44AD', '#9B59B6'] as const;
      default: return [Colors.primary, Colors.primary + '80'] as const;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'devotional': return 'book-outline';
      case 'prayer': return 'heart-outline';
      case 'journal': return 'journal-outline';
      case 'scripture': return 'library-outline';
      case 'service': return 'hand-left-outline';
      case 'community': return 'people-outline';
      default: return 'trophy-outline';
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const isUserJoined = (_challengeId: string) => {
    // TODO: Implement user challenge participation tracking
    // For now, return false as community features are disabled
    return false;
  };

  const getFilteredChallenges = () => {
    if (activeTab === 'available') {
      return challenges.filter(challenge => !isUserJoined(challenge.id));
    } else {
      return challenges.filter(challenge => isUserJoined(challenge.id));
    }
  };

  const ChallengeCard = ({ challenge }: { challenge: Challenge }) => { // eslint-disable-line react/no-unstable-nested-components
    const daysRemaining = getDaysRemaining(challenge.endDate);
    // Ensure we have a mutable array for LinearGradient colors
    const difficultyColors = [...getDifficultyGradient(challenge.difficulty)];
    const joined = isUserJoined(challenge.id);

    return (
      <TouchableOpacity
        style={styles.challengeCard}
        onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
      >
        <LinearGradient
          colors={difficultyColors}
          style={styles.challengeHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.challengeHeaderContent}>
            <View style={styles.challengeIconContainer}>
              <Ionicons
                name={getCategoryIcon(challenge.category)}
                size={24}
                color="#fff"
              />
            </View>
            <View style={styles.challengeHeaderText}>
              <Text style={styles.challengeTitle} numberOfLines={1}>
                {challenge.title}
              </Text>
              <Text style={styles.challengeDifficulty}>
                {challenge.difficulty.toUpperCase()} • {challenge.duration} days
              </Text>
            </View>
            <View style={styles.challengeStatus}>
              {joined ? (
                <View style={styles.joinedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.joinedText}>Joined</Text>
                </View>
              ) : (
                <Text style={styles.participantsText}>
                  Available
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.challengeBody}>
          <Text style={styles.challengeDescription} numberOfLines={3}>
            {challenge.description}
          </Text>

          <View style={styles.challengeDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={Colors.gray} />
              <Text style={styles.detailText}>
                {daysRemaining > 0 ? `${daysRemaining} days left` : 'Ended'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="book-outline" size={16} color={Colors.gray} />
              <Text style={styles.detailText}>
                From Playbook
              </Text>
            </View>
          </View>

          {/* Requirements */}
          {challenge.requirements && Object.keys(challenge.requirements).length > 0 && (
            <View style={styles.requirementsSection}>
              <Text style={styles.requirementsTitle}>Requirements:</Text>
              <View style={styles.requirementsList}>
                {challenge.requirements.level && (
                  <View style={styles.requirementItem}>
                    <Ionicons name="star-outline" size={14} color={Colors.gray} />
                    <Text style={styles.requirementText}>
                      Level {challenge.requirements.level}+
                    </Text>
                  </View>
                )}
                {challenge.requirements.badges && challenge.requirements.badges.length > 0 && (
                  <View style={styles.requirementItem}>
                    <Ionicons name="medal-outline" size={14} color={Colors.gray} />
                    <Text style={styles.requirementText}>
                      {challenge.requirements.badges.length} badge(s)
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Rewards */}
          <View style={styles.rewardsSection}>
            <Text style={styles.rewardsTitle}>Rewards:</Text>
            <View style={styles.rewardsList}>
              <View style={styles.rewardItem}>
                <Ionicons name="trophy" size={16} color="#FFD700" />
                <Text style={styles.rewardText}>
                  {challenge.rewards.points.toLocaleString()} points
                </Text>
              </View>
              <View style={styles.rewardItem}>
                <Ionicons name="flash" size={16} color="#3498DB" />
                <Text style={styles.rewardText}>
                  {challenge.rewards.experience} XP
                </Text>
              </View>
              {challenge.rewards.badges.length > 0 && (
                <View style={styles.rewardItem}>
                  <Ionicons name="medal" size={16} color="#9B59B6" />
                  <Text style={styles.rewardText}>
                    {challenge.rewards.badges.length} badge(s)
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Button */}
          {!joined && daysRemaining > 0 && (
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: getDifficultyColor(challenge.difficulty) }]}
              onPress={() => handleJoinChallenge(challenge.id)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.joinButtonText}>Join Challenge</Text>
            </TouchableOpacity>
          )}

          {joined && (
            <TouchableOpacity
              style={styles.viewProgressButton}
              onPress={() => navigation.navigate('ChallengeProgress', { challengeId: challenge.id })}
            >
              <Ionicons name="bar-chart-outline" size={20} color={Colors.primary} />
              <Text style={styles.viewProgressButtonText}>View Progress</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = ({ type }: { type: 'available' | 'joined' }) => ( // eslint-disable-line react/no-unstable-nested-components
    <View style={styles.emptyState}>
      <Ionicons
        name={type === 'available' ? 'trophy-outline' : 'ribbon-outline'}
        size={64}
        color={Colors.gray}
      />
      <Text style={styles.emptyStateTitle}>
        {type === 'available' ? 'No Available Challenges' : 'No Joined Challenges'}
      </Text>
      <Text style={styles.emptyStateText}>
        {type === 'available'
          ? 'Check back later for new challenges to join'
          : 'Join some challenges to track your progress here'
        }
      </Text>
    </View>
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
        <Text style={styles.headerTitle}>Challenges</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            Available ({getFilteredChallenges().length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'joined' && styles.activeTab]}
          onPress={() => setActiveTab('joined')}
        >
          <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
            Joined ({challenges.filter(c => isUserJoined(c.id)).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Challenges List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading challenges...</Text>
          </View>
        ) : (
          <>
            {getFilteredChallenges().length > 0 ? (
              getFilteredChallenges().map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))
            ) : (
              <EmptyState type={activeTab} />
            )}
          </>
        )}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray,
  },
  activeTabText: {
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  challengeHeader: {
    padding: 20,
  },
  challengeHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  challengeHeaderText: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  challengeDifficulty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  challengeStatus: {
    alignItems: 'flex-end',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  joinedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  participantsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  challengeBody: {
    padding: 20,
  },
  challengeDescription: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 16,
  },
  challengeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 6,
  },
  requirementsSection: {
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  requirementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 4,
  },
  rewardsSection: {
    marginBottom: 20,
  },
  rewardsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  rewardsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  rewardText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
    marginLeft: 4,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  viewProgressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  viewProgressButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});

export default ChallengesScreen;
