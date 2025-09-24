/**
 * Faith Points System
 * Gamification engine for user engagement and retention
 * NO UI changes - integrates with existing components
 */

import { supabase } from './supabaseClient';
import { notificationService } from './notificationService';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from './faithPointsEvents';

export interface FaithPointsProfile {
  userId: string;
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  achievements: Achievement[];
  weeklyGoal: number;
  weeklyProgress: number;
  lastActivityDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  pointsRequired: number;
  unlockedAt?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'generation' | 'journaling' | 'consistency' | 'growth';
  progress: number;
  target: number;
  completed: boolean;
  pointsReward: number;
  completedAt?: string;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  points: number;
  reason: string;
  category: 'playbook' | 'devotional' | 'journal' | 'streak' | 'achievement' | 'bonus';
  metadata?: any;
  createdAt: string;
}

export interface LevelInfo {
  level: number;
  name: string;
  description: string;
  pointsRequired: number;
  benefits: string[];
  badge?: Badge;
}

export class FaithPointsService {

  // Level progression system
  private readonly LEVELS: LevelInfo[] = [
    { level: 1, name: 'Seeker', description: 'Beginning your faith journey', pointsRequired: 0, benefits: ['Basic features'] },
    { level: 2, name: 'Believer', description: 'Growing in faith', pointsRequired: 100, benefits: ['Enhanced content'] },
    { level: 3, name: 'Disciple', description: 'Committed to growth', pointsRequired: 300, benefits: ['Priority support'] },
    { level: 4, name: 'Servant', description: 'Serving others', pointsRequired: 600, benefits: ['Advanced features'] },
    { level: 5, name: 'Leader', description: 'Leading by example', pointsRequired: 1000, benefits: ['Leadership content'] },
    { level: 6, name: 'Teacher', description: 'Sharing wisdom', pointsRequired: 1500, benefits: ['Teaching resources'] },
    { level: 7, name: 'Mentor', description: 'Guiding others', pointsRequired: 2500, benefits: ['Mentorship tools'] },
    { level: 8, name: 'Elder', description: 'Wise in faith', pointsRequired: 4000, benefits: ['Elder privileges'] },
    { level: 9, name: 'Steward', description: 'Faithful steward of God\'s gifts', pointsRequired: 6000, benefits: ['Steward status'] },
    { level: 10, name: 'Ambassador', description: 'Spreading the faith', pointsRequired: 10000, benefits: ['Ambassador recognition'] },
  ];

  // Points awarded for different activities
  private readonly POINTS_SYSTEM = {
    affirmation_read_aloud: 2,
    playbook_generated: 10,
    devotional_generated: 8,
    devotional_completed: 5,
    journal_entry: 5,
    prayer_for_now: 2,
    prayer_journal_acts: 2,
    prayer_journal_open: 2,
    prayer_devotional_prayed: 2,
    prayer_list_prayed: 2,
    prayer_list_request_added: 1,
    subtask_completed: 1,
    action_step_completed: 3,
    playbook_completed: 10,
    daily_streak: 5,
    weekly_goal_met: 25,
    content_shared: 15,
    feedback_given: 8,
    achievement_unlocked: 50,
  };

  /**
   * Get points configured for a specific activity key
   */
  public getPointsForActivity(activity: keyof typeof this.POINTS_SYSTEM): number {
    return this.POINTS_SYSTEM[activity];
  }

  /**
   * Check if a specific activity already has a transaction for the current day (local device day)
   */
  public async hasActivityToday(userId: string, activity: string): Promise<boolean> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('faith_points_log')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('activity_type', activity)
        .gte('created_at', startOfDay.toISOString())
        .limit(1);

      return !!(data && data.length > 0);
    } catch (error) {
      console.warn('[FaithPointsService] hasActivityToday check failed, defaulting to false', error);
      return false;
    }
  }

  /**
   * Check if a specific activity for a specific playbook already has a transaction for the current day
   * Uses metadata.playbookId to scope the check per playbook
   */
  public async hasActivityTodayForPlaybook(
    userId: string,
    activity: string,
    playbookId: string
  ): Promise<boolean> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('faith_points_log')
        .select('id, created_at, metadata')
        .eq('user_id', userId)
        .eq('activity_type', activity)
        .gte('created_at', startOfDay.toISOString())
        .contains('metadata', { playbookId })
        .limit(1);

      return !!(data && data.length > 0);
    } catch (error) {
      console.warn('[FaithPointsService] hasActivityTodayForPlaybook check failed, defaulting to false', error);
      return false;
    }
  }

  /**
   * Get user's faith points profile
   */
  async getUserProfile(userId: string): Promise<FaithPointsProfile> {
    try {
      console.log(`[FaithPointsService] Fetching profile for user: ${userId}`);

      const { data: profile, error } = await supabase
        .from('faith_points_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to avoid errors when no data found

      if (error) {
        console.error('[FaithPointsService] Database error getting profile:', error);
        return await this.createUserProfile(userId);
      }

      if (!profile) {
        console.log('[FaithPointsService] No profile found, creating new one');
        return await this.createUserProfile(userId);
      }

      console.log('[FaithPointsService] Profile found:', {
        totalPoints: profile.total_points,
        currentLevel: profile.current_level,
      });

      // Update streak and level if needed
      const updatedProfile = await this.updateProfileMetrics(profile);
      return updatedProfile;

    } catch (error) {
      console.error('[FaithPointsService] Unexpected error getting user profile:', error);
      return await this.createUserProfile(userId);
    }
  }

  /**
   * Award points for user activity
   */
  async awardPoints(
    userId: string,
    activity: keyof typeof this.POINTS_SYSTEM,
    _metadata?: { suppressNotification?: boolean; isOnboarding?: boolean } & any
  ): Promise<{ pointsAwarded: number; newLevel?: number; newBadges?: Badge[] }> {

    try {
      const pointsAwarded = this.POINTS_SYSTEM[activity];
      const isOnboarding = _metadata?.isOnboarding || false;
      
      console.log(`[FaithPointsService] Awarding ${pointsAwarded} points for ${activity} to user ${userId}${isOnboarding ? ' (onboarding)' : ''}`);

      // Ensure profile exists before awarding points
      let profile = await this.getUserProfile(userId);
      
      // If profile creation failed, try again with more robust error handling
      if (!profile || profile.totalPoints === undefined) {
        console.log('[FaithPointsService] Profile missing or invalid, creating new profile...');
        profile = await this.createUserProfile(userId);
      }

      const newTotalPoints = profile.totalPoints + pointsAwarded;

      console.log('[FaithPointsService] Current profile:', {
        totalPoints: profile.totalPoints,
        newTotalPoints,
        pointsAwarded,
        isOnboarding,
      });

      // Check for level up
      const currentLevel = this.calculateLevel(profile.totalPoints);
      const newLevel = this.calculateLevel(newTotalPoints);
      const leveledUp = newLevel > currentLevel;

      // Check for new badges
      const newBadges = await this.checkForNewBadges(userId, newTotalPoints, activity);

      // Update streak if daily activity
      const updatedStreak = await this.updateStreak(userId, activity);

      // Update profile in database with retry logic for onboarding
      console.log('[FaithPointsService] Updating profile with:', {
        total_points: newTotalPoints,
        current_level: newLevel,
        userId,
        isOnboarding,
      });

      let updateResult;
      let updateError;
      
      // Try upsert for onboarding to handle race conditions
      if (isOnboarding) {
        const { data: upsertResult, error: upsertError } = await supabase
          .from('faith_points_profiles')
          .upsert({
            user_id: userId,
            total_points: newTotalPoints,
            current_level: newLevel,
            points_to_next_level: this.getPointsToNextLevel(newTotalPoints),
            current_streak: updatedStreak,
            longest_streak: Math.max(profile.longestStreak || 0, updatedStreak),
            weekly_goal: profile.weeklyGoal || 50,
            weekly_progress: profile.weeklyProgress || 0,
            last_activity_date: new Date().toISOString(),
            created_at: profile.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          })
          .select();
          
        updateResult = upsertResult;
        updateError = upsertError;
        
        if (upsertError) {
          console.error('[FaithPointsService] Upsert failed, trying regular update:', upsertError);
        } else {
          console.log('[FaithPointsService] Upsert successful for onboarding:', upsertResult);
        }
      }
      
      // Fallback to regular update if upsert failed or not onboarding
      if (!updateResult || updateError) {
        const { data: regularUpdateResult, error: regularUpdateError } = await supabase
          .from('faith_points_profiles')
          .update({
            total_points: newTotalPoints,
            current_level: newLevel,
            points_to_next_level: this.getPointsToNextLevel(newTotalPoints),
            current_streak: updatedStreak,
            last_activity_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .select();

        updateResult = regularUpdateResult;
        updateError = regularUpdateError;
      }

      if (updateError) {
        console.error('[FaithPointsService] Profile update failed:', updateError);
        // For onboarding, don't throw error - log and continue
        if (isOnboarding) {
          console.warn('[FaithPointsService] Onboarding faith points update failed, but continuing...');
        } else {
          throw updateError;
        }
      }

      console.log('[FaithPointsService] Profile updated successfully:', updateResult);

      // Verify the update worked
      if (!updateResult || updateResult.length === 0) {
        console.error('[FaithPointsService] Update returned no data - profile may not exist or RLS issue');
        // Try to fetch the profile again to see current state
        const { data: afterUpdate } = await supabase
          .from('faith_points_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        console.log('[FaithPointsService] Profile state after update attempt:', afterUpdate);
        
        // For onboarding, try to create profile if it doesn't exist
        if (isOnboarding && !afterUpdate) {
          console.log('[FaithPointsService] Creating profile for onboarding user...');
          await this.createUserProfile(userId);
          // Retry the points award
          return this.awardPoints(userId, activity, { ..._metadata, isOnboarding: false });
        }
      }

      // Record transaction AFTER profile update (non-blocking)
      console.log('[FaithPointsService] Recording transaction...');
      try {
        await this.recordTransaction(userId, pointsAwarded, activity, _metadata);
        console.log('[FaithPointsService] Transaction recorded successfully');
      } catch (transactionError) {
        console.warn('[FaithPointsService] Transaction logging failed, but faith points were awarded:', transactionError);
        // Continue execution - don't let transaction logging failure block faith points
      }

      // Award bonus points for level up
      if (leveledUp) {
        await this.recordTransaction(userId, 50, 'achievement', { type: 'level_up', level: newLevel });
        // Show level up notification (unless suppressed)
        if (!_metadata?.suppressNotification) {
          notificationService.showPointsNotification(50, 'level_up', 'center');
        }
      }

      // Show points notification unless suppressed
      if (!_metadata?.suppressNotification) {
        notificationService.showPointsNotification(pointsAwarded, activity, 'center');
      }

      // Emit events for UI updates with delay to ensure database is updated
      setTimeout(() => {
        faithPointsEvents.emit(FAITH_POINTS_EVENTS.POINTS_UPDATED, {
          userId,
          pointsAwarded,
          totalPoints: newTotalPoints,
          level: newLevel,
        });

        if (leveledUp) {
          faithPointsEvents.emit(FAITH_POINTS_EVENTS.LEVEL_UP, {
            userId,
            newLevel,
            totalPoints: newTotalPoints,
          });
        }
      }, 100); // Small delay to ensure database transaction is complete

      return {
        pointsAwarded,
        newLevel: leveledUp ? newLevel : undefined,
        newBadges,
      };

    } catch (error) {
      console.error('[FaithPointsService] Error awarding points:', error);
      return { pointsAwarded: 0 };
    }
  }

  /**
   * Get user's recent transactions
   */
  async getRecentTransactions(userId: string, limit: number = 10): Promise<PointsTransaction[]> {
    try {
      const { data: transactions } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return transactions || [];
    } catch (error) {
      console.error('[FaithPointsService] Error getting transactions:', error);
      return [];
    }
  }

  /**
   * Get available badges
   */
  async getAvailableBadges(): Promise<Badge[]> {
    return [
      {
        id: 'first_playbook',
        name: 'First Steps',
        description: 'Generated your first playbook',
        icon: '👶',
        rarity: 'common',
        pointsRequired: 10,
      },
      {
        id: 'consistent_week',
        name: 'Faithful Week',
        description: 'Used the app 7 days in a row',
        icon: '🔥',
        rarity: 'common',
        pointsRequired: 35,
      },
      {
        id: 'prayer_warrior',
        name: 'Prayer Warrior',
        description: 'Generated 10 devotionals',
        icon: '🙏',
        rarity: 'rare',
        pointsRequired: 80,
      },
      {
        id: 'growth_seeker',
        name: 'Growth Seeker',
        description: 'Generated 25 playbooks',
        icon: '🌱',
        rarity: 'rare',
        pointsRequired: 250,
      },
      {
        id: 'journal_keeper',
        name: 'Journal Keeper',
        description: 'Made 50 journal entries',
        icon: '📖',
        rarity: 'epic',
        pointsRequired: 250,
      },
      {
        id: 'streak_master',
        name: 'Streak Master',
        description: '30-day streak',
        icon: '⚡',
        rarity: 'epic',
        pointsRequired: 150,
      },
      {
        id: 'faith_champion',
        name: 'Faith Champion',
        description: 'Reached level 5',
        icon: '👑',
        rarity: 'legendary',
        pointsRequired: 1000,
      },
    ];
  }

  /**
   * Get user's achievements
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const { data: achievements } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);

      return achievements || [];
    } catch (error) {
      console.error('[FaithPointsService] Error getting achievements:', error);
      return [];
    }
  }

  /**
   * Create new user profile
   */
  private async createUserProfile(userId: string): Promise<FaithPointsProfile> {
    const newProfile: FaithPointsProfile = {
      userId,
      totalPoints: 0,
      currentLevel: 1,
      pointsToNextLevel: 100,
      currentStreak: 0,
      longestStreak: 0,
      badges: [],
      achievements: [],
      weeklyGoal: 50,
      weeklyProgress: 0,
      lastActivityDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await supabase
        .from('faith_points_profiles')
        .insert({
          user_id: userId,
          total_points: 0,
          current_level: 1,
          current_streak: 0,
          longest_streak: 0,
          weekly_goal: 50,
          weekly_progress: 0,
          last_activity_date: new Date().toISOString(),
        });

      console.log(`[FaithPointsService] Created new profile for user ${userId}`);
      return newProfile;

    } catch (error) {
      console.error('[FaithPointsService] Error creating profile:', error);
      return newProfile;
    }
  }

  /**
   * Record points transaction
   */
  private async recordTransaction(
    userId: string,
    points: number,
    reason: string,
    metadata?: any
  ): Promise<void> {
    try {
      const transactionData = {
        user_id: userId,
        points: points,
        activity_type: reason,
        reason: this.getCategoryFromReason(reason),
        metadata: metadata || null,
        created_at: new Date().toISOString(),
      };

      console.log('[FaithPointsService] Inserting transaction:', transactionData);

      // Try manual SQL query to bypass schema cache
      console.log('[FaithPointsService] Attempting manual SQL insert...');

      const manualQuery = `
        INSERT INTO faith_points_log (user_id, points, activity_type, reason, metadata, created_at)
        VALUES ('${userId}', ${points}, '${reason}', '${this.getCategoryFromReason(reason)}', ${metadata ? `'${JSON.stringify(metadata)}'` : 'NULL'}, NOW())
        RETURNING *;
      `;

      const { data: manualData, error: manualError } = await supabase
        .rpc('execute_sql', { query: manualQuery });

      if (manualError || !manualData) {
        console.log('[FaithPointsService] Manual SQL failed, trying simple insert...');

        // Try the simplest possible insert
        const { data, error } = await supabase
          .from('faith_points_log')
          .insert({
            user_id: userId,
            points: points,
            activity_type: reason,
            reason: this.getCategoryFromReason(reason),
            metadata: metadata || null,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error('[FaithPointsService] All insert methods failed:', error);
          // Don't throw error, just log it so faith points awarding continues
          console.log('[FaithPointsService] Continuing without transaction logging...');
          return;
        }

        console.log('[FaithPointsService] Simple insert succeeded:', data);
        return;
      }

      console.log('[FaithPointsService] Manual SQL succeeded:', manualData);
      return;
    } catch (error) {
      console.error('[FaithPointsService] Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Calculate user level from total points
   */
  private calculateLevel(totalPoints: number): number {
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (totalPoints >= this.LEVELS[i].pointsRequired) {
        return this.LEVELS[i].level;
      }
    }
    return 1;
  }

  /**
   * Get points needed for next level
   */
  private getPointsToNextLevel(totalPoints: number): number {
    const currentLevel = this.calculateLevel(totalPoints);
    const nextLevel = this.LEVELS.find(l => l.level > currentLevel);

    if (!nextLevel) {return 0;}
    return nextLevel.pointsRequired - totalPoints;
  }

  /**
   * Update user streak
   */
  private async updateStreak(userId: string, _activity: string): Promise<number> {
    try {
      const today = new Date().toDateString();
      const { data: profile } = await supabase
        .from('faith_points_profiles')
        .select('current_streak, longest_streak, last_activity_date')
        .eq('user_id', userId)
        .single();

      if (!profile) {return 1;}

      const lastActivityDate = new Date(profile.last_activity_date).toDateString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

      let newStreak = profile.current_streak;

      if (lastActivityDate === today) {
        // Same day, no streak change
        return newStreak;
      } else if (lastActivityDate === yesterday) {
        // Consecutive day, increment streak
        newStreak = profile.current_streak + 1;
      } else {
        // Streak broken, reset to 1
        newStreak = 1;
      }

      // Update longest streak if needed
      const newLongestStreak = Math.max(profile.longest_streak, newStreak);

      await supabase
        .from('faith_points_profiles')
        .update({
          current_streak: newStreak,
          longest_streak: newLongestStreak,
        })
        .eq('user_id', userId);

      return newStreak;

    } catch (error) {
      console.error('[FaithPointsService] Error updating streak:', error);
      return 1;
    }
  }

  /**
   * Check for new badges earned
   */
  private async checkForNewBadges(
    userId: string,
    totalPoints: number,
    activity: string
  ): Promise<Badge[]> {
    try {
      const availableBadges = await this.getAvailableBadges();
      const userBadges = await this.getUserBadges(userId);
      const userBadgeIds = userBadges.map(b => b.id);

      const newBadges: Badge[] = [];

      for (const badge of availableBadges) {
        if (!userBadgeIds.includes(badge.id) && totalPoints >= badge.pointsRequired) {
          // Check specific badge requirements
          const earned = await this.checkBadgeRequirement(userId, badge, activity);
          if (earned) {
            newBadges.push(badge);
            await this.awardBadge(userId, badge);
          }
        }
      }

      return newBadges;

    } catch (error) {
      console.error('[FaithPointsService] Error checking badges:', error);
      return [];
    }
  }

  /**
   * Helper methods
   */
  private getCategoryFromReason(reason: string): string {
    if (reason.includes('playbook')) {return 'playbook';}
    if (reason.includes('devotional')) {return 'devotional';}
    if (reason.includes('prayer')) {return 'prayer';}
    if (reason.includes('journal')) {return 'journal';}
    if (reason.includes('streak')) {return 'streak';}
    if (reason.includes('achievement')) {return 'achievement';}
    return 'bonus';
  }

  private async getUserBadges(userId: string): Promise<Badge[]> {
    try {
      const { data: badges } = await supabase
        .from('user_badges')
        .select('badge_data')
        .eq('user_id', userId);

      return badges?.map(b => b.badge_data) || [];
    } catch (error) {
      return [];
    }
  }

  private async checkBadgeRequirement(userId: string, badge: Badge, activity: string): Promise<boolean> {
    // Implement specific badge requirement checks
    switch (badge.id) {
      case 'first_playbook':
        return activity === 'playbook_generated';
      case 'prayer_warrior':
        return await this.getActivityCount(userId, 'devotional_generated') >= 10;
      case 'growth_seeker':
        return await this.getActivityCount(userId, 'playbook_generated') >= 25;
      default:
        return true;
    }
  }

  private async getActivityCount(userId: string, activity: string): Promise<number> {
    try {
      const { data: transactions } = await supabase
        .from('faith_points_log')
        .select('id')
        .eq('user_id', userId)
        .eq('activity_type', activity);

      return transactions?.length || 0;
    } catch (error) {
      return 0;
    }
  }

  private async awardBadge(userId: string, badge: Badge): Promise<void> {
    try {
      await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badge.id,
          badge_data: badge,
          unlocked_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[FaithPointsService] Error awarding badge:', error);
    }
  }

  private async updateProfileMetrics(profile: any): Promise<FaithPointsProfile> {
    // Convert database format to interface format
    return {
      userId: profile.user_id,
      totalPoints: profile.total_points,
      currentLevel: profile.current_level,
      pointsToNextLevel: profile.points_to_next_level,
      currentStreak: profile.current_streak,
      longestStreak: profile.longest_streak,
      badges: [],
      achievements: [],
      weeklyGoal: profile.weekly_goal,
      weeklyProgress: profile.weekly_progress,
      lastActivityDate: profile.last_activity_date,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }
}

// Export singleton instance
export const faithPointsService = new FaithPointsService();
