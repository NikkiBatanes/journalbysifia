import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { userApi } from '../../services/userApi';
import { Goal } from '../../types/auth';

interface Props {
  navigation: any;
}

const GoalsScreen: React.FC<Props> = ({ navigation }) => {
  // const { user: _user } = useAuth(); // Unused
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const response = await userApi.getUserProgress(''); // Will get from context
      if (response.success && response.data) {
        const allGoals = [...response.data.activeGoals, ...response.data.completedGoals];
        setGoals(allGoals);
      }
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  const handleDeleteGoal = async (goalId: string) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await userApi.deleteGoal('', goalId);
              if (response.success) {
                setGoals(prev => prev.filter(g => g.id !== goalId));
              } else {
                Alert.alert('Error', 'Failed to delete goal. Please try again.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete goal. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleGoalStatus = async (goal: Goal) => {
    try {
      const updates: Partial<Goal> = {
        isActive: !goal.isActive,
      };

      if (!goal.isActive) {
        // Reactivating goal
        updates.isCompleted = false;
        updates.completedAt = undefined;
      }

      const response = await userApi.updateGoal('', goal.id, updates);
      if (response.success) {
        setGoals(prev => prev.map(g =>
          g.id === goal.id ? { ...g, ...updates } : g
        ));
      } else {
        Alert.alert('Error', 'Failed to update goal. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal. Please try again.');
    }
  };

  const getFilteredGoals = () => {
    return goals.filter(goal =>
      activeTab === 'active' ? goal.isActive && !goal.isCompleted : goal.isCompleted
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'devotional': return 'book-outline';
      case 'prayer': return 'heart-outline';
      case 'journal': return 'journal-outline';
      case 'scripture': return 'library-outline';
      case 'service': return 'hand-left-outline';
      default: return 'flag-outline';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'devotional': return Colors.playbookBlue;
      case 'prayer': return Colors.gratitudeRed;
      case 'journal': return Colors.prayerPurple;
      case 'scripture': return Colors.winGold;
      case 'service': return Colors.budgetingGreen;
      default: return Colors.primary;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      case 'one_time': return 'One-time';
      default: return type;
    }
  };

  const GoalCard = ({ goal }: { goal: Goal }) => { // eslint-disable-line react/no-unstable-nested-components
    const progress = goal.targetValue > 0 ? goal.currentValue / goal.targetValue : 0;
    const categoryColor = getCategoryColor(goal.category);

    return (
      <TouchableOpacity
        style={styles.goalCard}
        onPress={() => navigation.navigate('GoalDetail', { goalId: goal.id })}
      >
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleRow}>
            <View style={[styles.categoryIcon, { backgroundColor: categoryColor + '20' }]}>
              <Ionicons
                name={getCategoryIcon(goal.category)}
                size={20}
                color={categoryColor}
              />
            </View>
            <View style={styles.goalTitleContainer}>
              <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
              <Text style={styles.goalType}>{getTypeLabel(goal.type)}</Text>
            </View>
          </View>

          <View style={styles.goalActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToggleGoalStatus(goal)}
            >
              <Ionicons
                name={goal.isActive ? 'pause-outline' : 'play-outline'}
                size={20}
                color={Colors.gray}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('EditGoal', { goalId: goal.id })}
            >
              <Ionicons name="pencil-outline" size={20} color={Colors.gray} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteGoal(goal.id)}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {goal.description && (
          <Text style={styles.goalDescription} numberOfLines={2}>
            {goal.description}
          </Text>
        )}

        <View style={styles.progressSection}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {goal.currentValue} / {goal.targetValue} {goal.unit}
            </Text>
            <Text style={styles.progressPercentage}>
              {Math.round(progress * 100)}%
            </Text>
          </View>

          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: categoryColor,
                },
              ]}
            />
          </View>
        </View>

        {goal.endDate && (
          <View style={styles.goalFooter}>
            <Text style={styles.dueDateText}>
              Due: {new Date(goal.endDate).toLocaleDateString()}
            </Text>
            {goal.reward && (
              <View style={styles.rewardContainer}>
                <Ionicons name="gift-outline" size={16} color={Colors.primary} />
                <Text style={styles.rewardText}>
                  {goal.reward.points} pts
                </Text>
              </View>
            )}
          </View>
        )}

        {goal.isCompleted && goal.completedAt && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.budgetingGreen} />
            <Text style={styles.completedText}>
              Completed {new Date(goal.completedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const EmptyState = ({ type }: { type: 'active' | 'completed' }) => ( // eslint-disable-line react/no-unstable-nested-components
    <View style={styles.emptyState}>
      <Ionicons
        name={type === 'active' ? 'flag-outline' : 'trophy-outline'}
        size={64}
        color={Colors.gray}
      />
      <Text style={styles.emptyStateTitle}>
        {type === 'active' ? 'No Active Goals' : 'No Completed Goals'}
      </Text>
      <Text style={styles.emptyStateText}>
        {type === 'active'
          ? 'Create your first goal to start tracking your spiritual journey'
          : 'Complete some goals to see them here'
        }
      </Text>
      {type === 'active' && (
        <TouchableOpacity
          style={styles.createGoalButton}
          onPress={() => navigation.navigate('CreateGoal')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createGoalButtonText}>Create Goal</Text>
        </TouchableOpacity>
      )}
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
        <Text style={styles.headerTitle}>My Goals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateGoal')}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({goals.filter(g => g.isActive && !g.isCompleted).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({goals.filter(g => g.isCompleted).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Goals List */}
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
            <Text>Loading goals...</Text>
          </View>
        ) : (
          <>
            {getFilteredGoals().length > 0 ? (
              getFilteredGoals().map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
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
    backgroundColor: Colors.sanctuaryWhite,
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
  addButton: {
    padding: 4,
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
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  goalType: {
    fontSize: 12,
    color: Colors.gray,
    textTransform: 'capitalize',
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  goalDescription: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: Colors.gentleBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dueDateText: {
    fontSize: 12,
    color: Colors.gray,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  completedText: {
    fontSize: 12,
    color: Colors.budgetingGreen,
    fontWeight: '500',
    marginLeft: 4,
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
    marginBottom: 24,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createGoalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});

export default GoalsScreen;
