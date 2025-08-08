import { supabase } from './supabaseClient';
import { User, UserPreferences, Goal, Challenge, UserProgress, Badge, AuthError } from '../types/auth';
import { faithPointsService } from './faithPointsService';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AuthError;
}

class UserApiService {
  async updateProfile(accessToken: string, updates: Partial<User>): Promise<ApiResponse<Partial<User>>> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      // Update auth user data if needed
      const authUpdates: any = {};
      if (updates.email) {authUpdates.email = updates.email;}

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates);
        if (authError) {
          return {
            success: false,
            error: { code: 'UPDATE_FAILED', message: authError.message },
          };
        }
      }

      // Update profile data
      const profileUpdates: any = {};
      if (updates.firstName) {profileUpdates.first_name = updates.firstName;}
      if (updates.lastName) {profileUpdates.last_name = updates.lastName;}
      if (updates.displayName) {profileUpdates.display_name = updates.displayName;}
      if (updates.avatar) {profileUpdates.avatar_url = updates.avatar;}
      if (updates.phoneNumber) {profileUpdates.phone_number = updates.phoneNumber;}
      if (updates.dateOfBirth) {profileUpdates.date_of_birth = updates.dateOfBirth;}
      if (updates.gender) {profileUpdates.gender = updates.gender;}
      if (updates.spiritualLevel) {profileUpdates.spiritual_level = updates.spiritualLevel;}
      if (updates.denomination) {profileUpdates.denomination = updates.denomination;}
      if (updates.churchName) {profileUpdates.church_name = updates.churchName;}

      profileUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', user.user.id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        };
      }

      return {
        success: true,
        data: {
          firstName: data.first_name,
          lastName: data.last_name,
          displayName: data.display_name,
          avatar: data.avatar_url,
          phoneNumber: data.phone_number,
          dateOfBirth: data.date_of_birth,
          gender: data.gender,
          spiritualLevel: data.spiritual_level,
          denomination: data.denomination,
          churchName: data.church_name,
          updatedAt: data.updated_at,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update profile' },
      };
    }
  }

  async updatePreferences(accessToken: string, preferences: UserPreferences): Promise<ApiResponse> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.user.id);

      if (error) {
        return {
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update preferences' },
      };
    }
  }

  async getUserProgress(accessToken: string): Promise<ApiResponse<UserProgress>> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      // Get user progress data
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.user.id)
        .single();

      if (progressError && progressError.code !== 'PGRST116') { // Not found error
        return {
          success: false,
          error: { code: 'FETCH_FAILED', message: progressError.message },
        };
      }

      // Get goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.user.id);

      if (goalsError) {
        console.error('Goals fetch error:', goalsError);
      }

      const goals = goalsData || [];
      const activeGoals = goals.filter((g: any) => g.is_active && !g.is_completed);
      const completedGoals = goals.filter((g: any) => g.is_completed);
      const weeklyGoals = goals.filter((g: any) => g.type === 'weekly' && g.is_active);
      const monthlyGoals = goals.filter((g: any) => g.type === 'monthly' && g.is_active);

      const progress: UserProgress = {
        userId: user.user.id,
        totalDevotionals: progressData?.total_devotionals || 0,
        totalPrayers: progressData?.total_prayers || 0,
        totalJournalEntries: progressData?.total_journal_entries || 0,
        totalPlaybooksCompleted: progressData?.total_playbooks_completed || 0,
        currentStreak: progressData?.current_streak || 0,
        longestStreak: progressData?.longest_streak || 0,
        weeklyGoals: weeklyGoals.map(this.mapGoalFromDb),
        monthlyGoals: monthlyGoals.map(this.mapGoalFromDb),
        activeGoals: activeGoals.map(this.mapGoalFromDb),
        completedGoals: completedGoals.map(this.mapGoalFromDb),
        activeChallenges: progressData?.active_challenges || [],
        completedChallenges: progressData?.completed_challenges || [],
        lastUpdated: progressData?.updated_at || new Date().toISOString(),
      };

      return { success: true, data: progress };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch user progress' },
      };
    }
  }

  async updateUserProgress(accessToken: string, updates: Partial<UserProgress>): Promise<ApiResponse> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      const progressUpdates: any = {
        user_id: user.user.id,
        updated_at: new Date().toISOString(),
      };

      if (updates.totalDevotionals !== undefined) {progressUpdates.total_devotionals = updates.totalDevotionals;}
      if (updates.totalPrayers !== undefined) {progressUpdates.total_prayers = updates.totalPrayers;}
      if (updates.totalJournalEntries !== undefined) {progressUpdates.total_journal_entries = updates.totalJournalEntries;}
      if (updates.totalPlaybooksCompleted !== undefined) {progressUpdates.total_playbooks_completed = updates.totalPlaybooksCompleted;}
      if (updates.currentStreak !== undefined) {progressUpdates.current_streak = updates.currentStreak;}
      if (updates.longestStreak !== undefined) {progressUpdates.longest_streak = updates.longestStreak;}
      if (updates.activeChallenges !== undefined) {progressUpdates.active_challenges = updates.activeChallenges;}
      if (updates.completedChallenges !== undefined) {progressUpdates.completed_challenges = updates.completedChallenges;}

      const { error } = await supabase
        .from('user_progress')
        .upsert([progressUpdates]);

      if (error) {
        return {
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update progress' },
      };
    }
  }

  async createGoal(accessToken: string, goal: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Goal>> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      const goalData = {
        user_id: user.user.id,
        title: goal.title,
        description: goal.description,
        category: goal.category,
        type: goal.type,
        target_value: goal.targetValue,
        current_value: goal.currentValue,
        unit: goal.unit,
        start_date: goal.startDate,
        end_date: goal.endDate,
        is_active: goal.isActive,
        is_completed: goal.isCompleted,
        completed_at: goal.completedAt,
        reward: goal.reward,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('user_goals')
        .insert([goalData])
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: { code: 'CREATE_FAILED', message: error.message },
        };
      }

      return {
        success: true,
        data: this.mapGoalFromDb(data),
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'CREATE_FAILED', message: 'Failed to create goal' },
      };
    }
  }

  async updateGoal(accessToken: string, goalId: string, updates: Partial<Goal>): Promise<ApiResponse<Goal>> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      const goalUpdates: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.title) {goalUpdates.title = updates.title;}
      if (updates.description) {goalUpdates.description = updates.description;}
      if (updates.category) {goalUpdates.category = updates.category;}
      if (updates.type) {goalUpdates.type = updates.type;}
      if (updates.targetValue !== undefined) {goalUpdates.target_value = updates.targetValue;}
      if (updates.currentValue !== undefined) {goalUpdates.current_value = updates.currentValue;}
      if (updates.unit) {goalUpdates.unit = updates.unit;}
      if (updates.startDate) {goalUpdates.start_date = updates.startDate;}
      if (updates.endDate) {goalUpdates.end_date = updates.endDate;}
      if (updates.isActive !== undefined) {goalUpdates.is_active = updates.isActive;}
      if (updates.isCompleted !== undefined) {goalUpdates.is_completed = updates.isCompleted;}
      if (updates.completedAt) {goalUpdates.completed_at = updates.completedAt;}
      if (updates.reward) {goalUpdates.reward = updates.reward;}

      const { data, error } = await supabase
        .from('user_goals')
        .update(goalUpdates)
        .eq('id', goalId)
        .eq('user_id', user.user.id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        };
      }

      return {
        success: true,
        data: this.mapGoalFromDb(data),
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update goal' },
      };
    }
  }

  async deleteGoal(accessToken: string, goalId: string): Promise<ApiResponse> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      const { error } = await supabase
        .from('user_goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', user.user.id);

      if (error) {
        return {
          success: false,
          error: { code: 'DELETE_FAILED', message: error.message },
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Failed to delete goal' },
      };
    }
  }

  async getAvailableChallenges(): Promise<ApiResponse<Challenge[]>> {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: { code: 'FETCH_FAILED', message: error.message },
        };
      }

      const challenges: Challenge[] = data.map((challenge: any) => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        category: challenge.category,
        difficulty: challenge.difficulty,
        duration: challenge.duration,
        requirements: challenge.requirements,
        rewards: challenge.rewards,
        participants: challenge.participants,
        isActive: challenge.is_active,
        startDate: challenge.start_date,
        endDate: challenge.end_date,
        createdAt: challenge.created_at,
      }));

      return { success: true, data: challenges };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch challenges' },
      };
    }
  }

  async joinChallenge(accessToken: string, challengeId: string): Promise<ApiResponse> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      // Check if user is already in the challenge
      const { data: existing } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', user.user.id)
        .eq('challenge_id', challengeId)
        .single();

      if (existing) {
        return {
          success: false,
          error: { code: 'ALREADY_JOINED', message: 'Already joined this challenge' },
        };
      }

      // Join the challenge
      const { error } = await supabase
        .from('user_challenges')
        .insert([{
          user_id: user.user.id,
          challenge_id: challengeId,
          joined_at: new Date().toISOString(),
          is_active: true,
        }]);

      if (error) {
        return {
          success: false,
          error: { code: 'JOIN_FAILED', message: error.message },
        };
      }

      // Update challenge participants count
      await supabase.rpc('increment_challenge_participants', {
        challenge_id: challengeId,
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'JOIN_FAILED', message: 'Failed to join challenge' },
      };
    }
  }

  async addBadge(accessToken: string, badge: Omit<Badge, 'unlockedAt'>): Promise<ApiResponse> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      // Get current user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('badges')
        .eq('id', user.user.id)
        .single();

      if (profileError) {
        return {
          success: false,
          error: { code: 'FETCH_FAILED', message: profileError.message },
        };
      }

      const currentBadges = profile.badges || [];
      const badgeWithTimestamp = {
        ...badge,
        unlockedAt: new Date().toISOString(),
      };

      // Check if badge already exists
      const existingBadge = currentBadges.find((b: Badge) => b.id === badge.id);
      if (existingBadge) {
        return {
          success: false,
          error: { code: 'BADGE_EXISTS', message: 'Badge already unlocked' },
        };
      }

      const updatedBadges = [...currentBadges, badgeWithTimestamp];

      const { error } = await supabase
        .from('user_profiles')
        .update({
          badges: updatedBadges,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.user.id);

      if (error) {
        return {
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to add badge' },
      };
    }
  }

  async updateExperience(accessToken: string, experienceGained: number, pointsGained: number = 0): Promise<ApiResponse> {
    try {
      const { data: user } = await supabase.auth.getUser(accessToken);

      if (!user.user) {
        return {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
        };
      }

      // Get current user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('level, experience, total_points')
        .eq('id', user.user.id)
        .single();

      if (profileError) {
        return {
          success: false,
          error: { code: 'FETCH_FAILED', message: profileError.message },
        };
      }

      const currentLevel = profile.level || 1;
      const currentExperience = profile.experience || 0;
      const currentPoints = profile.total_points || 0;

      const newExperience = currentExperience + experienceGained;
      const newPoints = currentPoints + pointsGained;

      // Calculate new level (100 XP per level)
      const newLevel = Math.floor(newExperience / 100) + 1;
      const leveledUp = newLevel > currentLevel;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          level: newLevel,
          experience: newExperience,
          total_points: newPoints,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.user.id);

      if (error) {
        return {
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        };
      }

      // If user leveled up, award level-up badge
      if (leveledUp) {
        await this.addBadge(accessToken, {
          id: `level_${newLevel}`,
          name: `Level ${newLevel}`,
          description: `Reached level ${newLevel}`,
          icon: 'trophy',
          category: 'achievement',
          rarity: newLevel >= 50 ? 'legendary' : newLevel >= 25 ? 'epic' : newLevel >= 10 ? 'rare' : 'common',
        });
      }

      return { success: true, data: { leveledUp, newLevel, newExperience, newPoints } };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update experience' },
      };
    }
  }

  private mapGoalFromDb(dbGoal: any): Goal {
    return {
      id: dbGoal.id,
      userId: dbGoal.user_id,
      title: dbGoal.title,
      description: dbGoal.description,
      category: dbGoal.category,
      type: dbGoal.type,
      targetValue: dbGoal.target_value,
      currentValue: dbGoal.current_value,
      unit: dbGoal.unit,
      startDate: dbGoal.start_date,
      endDate: dbGoal.end_date,
      isActive: dbGoal.is_active,
      isCompleted: dbGoal.is_completed,
      completedAt: dbGoal.completed_at,
      reward: dbGoal.reward,
      createdAt: dbGoal.created_at,
      updatedAt: dbGoal.updated_at,
    };
  }

  async getProfileStats(userId: string): Promise<ApiResponse<any>> {
    try {
      // Use faith points service to get real user profile data
      const profile = await faithPointsService.getUserProfile(userId);

      // Get recent transactions to calculate additional stats
      const recentTransactions = await faithPointsService.getRecentTransactions(userId, 100);

      // Calculate activity counts using exact activity type matches
      const devotionalsFinished = recentTransactions.filter((t: any) =>
        t.activity_type === 'devotional_generated'
      ).length;

      const prayerSessions = recentTransactions.filter((t: any) =>
        t.activity_type === 'prayer_completed' || t.activity_type === 'daily_prayer'
      ).length;

      const journalEntries = recentTransactions.filter((t: any) =>
        t.activity_type === 'journal_entry'
      ).length;

      const playbooksCompleted = recentTransactions.filter((t: any) =>
        t.activity_type === 'playbook_generated'
      ).length;

      const actionStepsCompleted = recentTransactions.filter((t: any) =>
        t.activity_type === 'action_step_completed'
      ).length;

      const goalsCompleted = playbooksCompleted + actionStepsCompleted;

      // Calculate badges based on achievements (simplified for now)
      const totalBadges = Math.floor(profile.totalPoints / 50); // 1 badge per 50 points

      const profileStats = {
        faithPoints: profile.totalPoints,
        level: profile.currentLevel,
        totalBadges,
        currentStreak: profile.currentStreak,
        goalsCompleted,
        devotionalsFinished,
        prayerSessions,
        journalEntries,
      };

      console.log('📊 Profile Stats Calculated:', {
        userId,
        profile: {
          totalPoints: profile.totalPoints,
          currentLevel: profile.currentLevel,
          currentStreak: profile.currentStreak,
        },
        transactionCount: recentTransactions.length,
        calculatedStats: profileStats,
      });

      return {
        success: true,
        data: profileStats,
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: error.message },
      };
    }
  }

  async getRecentBadges(userId: string, limit: number = 5): Promise<ApiResponse<Badge[]>> {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          badge_id,
          earned_at,
          badges (
            name,
            description,
            icon,
            faith_points_reward,
            rarity
          )
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })
        .limit(limit);

      if (error) {
        return {
          success: false,
          error: { code: 'FETCH_FAILED', message: error.message },
        };
      }

      const badges = data.map((item: any) => ({
        id: item.badge_id,
        name: item.badges.name,
        description: item.badges.description,
        icon: item.badges.icon,
        rarity: item.badges.rarity,
        category: 'achievement',
        unlockedAt: item.earned_at,
      }));

      return {
        success: true,
        data: badges,
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: error.message },
      };
    }
  }

  async getAllUserBadges(userId: string): Promise<ApiResponse<Badge[]>> {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          badge_id,
          earned_at,
          badges (
            name,
            description,
            icon,
            faith_points_reward,
            rarity,
            category
          )
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: { code: 'FETCH_FAILED', message: error.message },
        };
      }

      const badges = data.map((item: any) => ({
        id: item.badge_id,
        name: item.badges.name,
        description: item.badges.description,
        icon: item.badges.icon,
        rarity: item.badges.rarity,
        category: (item.badges.category as 'streak' | 'devotional' | 'prayer' | 'journal' | 'playbook' | 'achievement') || 'achievement',
        unlockedAt: item.earned_at,
      }));

      return {
        success: true,
        data: badges,
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: error.message },
      };
    }
  }
}

export const userApi = new UserApiService();
