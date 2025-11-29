/**
 * Faith Points System
 * Gamification engine for user engagement and retention
 * NO UI changes - integrates with existing components
 */

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationService } from './notificationService';
import { faithPointsEvents, FAITH_POINTS_EVENTS } from './faithPointsEvents';
import { milestoneCelebrationService } from './milestoneCelebrationService';

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

export interface FaithPointsTransaction {
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
  // ENTERPRISE-GRADE: In-memory guard to prevent race conditions
  // Tracks badges currently being awarded to prevent duplicates
  private static badgesBeingAwarded: Map<string, Set<string>> = new Map();
  // Map<userId, Set<badgeName>>

  // ENTERPRISE-GRADE: Debounce timer for badge checking per user
  private static badgeCheckTimers: Map<string, NodeJS.Timeout> = new Map();

  // RATE LIMITER: Track last faith points award time per user to prevent rapid completion spam
  private static lastAwardTimes: Map<string, number> = new Map();

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
  // HIGHEST: Full devotional/playbook completion (max +5)
  // MEDIUM: Daily activities, prayers, journal (+2 to +3)
  // LOW: Generation, small actions (+1)
  private readonly POINTS_SYSTEM = {
    // Generation (lowest tier)
    affirmation_read_aloud: 1,
    playbook_generated: 2,
    devotional_generated: 2,

    // Completion (HIGHEST tier - scales with length)
    devotional_completed: 1, // Single day (1/3, 2/3) - very low
    devotional_full_completed: 5, // Full completion (3/3, 5/5, 7/7)
    playbook_completed: 5, // Full playbook completion (5/5, 6/6), matches devotional

    // Daily activities (medium tier)
    reflection_question_answered: 2, // Question to ponder
    journal_entry: 2,
    prayer_for_now: 3,
    prayer_journal_acts: 3,
    prayer_journal_open: 3,
    prayer_devotional_prayed: 3,
    prayer_list_prayed: 3,
    prayer_list_request_added: 1,
    prayer_answered: 3, // When marking prayer as answered (once per day)

    // Action steps (low-medium tier)
    subtask_completed: 1,
    action_step_completed: 2,

    // Streaks and milestones
    daily_streak: 3,
    weekly_goal_met: 10,
    content_shared: 5,
    feedback_given: 3,
    achievement_unlocked: 10,

    // Streak bonuses
    playbook_streak_3: 3,
    playbook_streak_7: 5,
    devotional_streak_3: 3,
    devotional_streak_7: 5,
    journal_streak_3: 3,
    journal_streak_7: 5,
    prayer_streak_3: 3,
    prayer_streak_7: 5,
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
      Logger.warn('[FaithPointsService] hasActivityToday check failed, defaulting to false', {
        component: 'faithPointsService',
        error: error as Error,
      });
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
      Logger.warn('[FaithPointsService] hasActivityTodayForPlaybook check failed, defaulting to false', {
        component: 'faithPointsService',
        error: error as Error,
      });
      return false;
    }
  }

  /**
   * Get user's faith points profile
   */
  async getUserProfile(userId: string): Promise<FaithPointsProfile> {
    try {

      const { data: profile, error } = await supabase
        .from('faith_points_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to avoid errors when no data found

      if (error) {
        Logger.error('[FaithPointsService] Database error getting profile', error as Error, {
      component: 'faithPointsService',
    });
        return await this.createUserProfile(userId);
      }

      if (!profile) {

        return await this.createUserProfile(userId);
      }

      // Update streak and level if needed
      const updatedProfile = await this.updateProfileMetrics(profile);
      return updatedProfile;

    } catch (error) {
      Logger.error('[FaithPointsService] Unexpected error getting user profile', error as Error, {
      component: 'faithPointsService',
    });
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
      // RATE LIMITER: Prevent rapid faith points awarding during devotional completion sprees
      const now = Date.now();
      const lastAwardTime = FaithPointsService.lastAwardTimes.get(userId) || 0;
      const timeSinceLastAward = now - lastAwardTime;

      // Block rapid completions: require at least 1 second between faith points awards
      if (timeSinceLastAward < 1000 && activity === 'devotional_completed') {
        Logger.debug('[FaithPointsService] Rate limiting rapid devotional completions', {
          component: 'faithPointsService',
          userId,
          activity,
          timeSinceLastAward,
        });
        return { pointsAwarded: 0 };
      }

      // Update last award time
      FaithPointsService.lastAwardTimes.set(userId, now);

      const pointsAwarded = this.POINTS_SYSTEM[activity];
      const isOnboarding = _metadata?.isOnboarding || false;

      // Ensure profile exists before awarding points
      let profile = await this.getUserProfile(userId);

      // If profile creation failed, try again with more robust error handling
      if (!profile || profile.totalPoints === undefined) {

        profile = await this.createUserProfile(userId);
      }

      const newTotalPoints = profile.totalPoints + pointsAwarded;

      // Check for level up
      const currentLevel = this.calculateLevel(profile.totalPoints);
      const newLevel = this.calculateLevel(newTotalPoints);
      const leveledUp = newLevel > currentLevel;

      // CRITICAL: Defer badge checking to prevent UI freeze
      // Badge checking makes database calls which block the UI thread
      // We'll check badges asynchronously after profile is updated
      let newBadges: Badge[] = [];

      // Update streak if daily activity
      const updatedStreak = await this.updateStreak(userId, activity);

      // Update profile in database with retry logic for onboarding

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
            onConflict: 'user_id',
          })
          .select();

        updateResult = upsertResult;
        updateError = upsertError;

        if (upsertError) {
          Logger.error('[FaithPointsService] Upsert failed, trying regular update', upsertError as Error, {
      component: 'faithPointsService',
    });
        } else {

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
        Logger.error('[FaithPointsService] Profile update failed', updateError as Error, {
      component: 'faithPointsService',
    });
        // For onboarding, don't throw error - log and continue
        if (isOnboarding) {
          Logger.warn('[FaithPointsService] Onboarding faith points update failed, but continuing...', {
      component: 'faithPointsService',
    });
        } else {
          throw updateError;
        }
      }

      // Verify the update worked
      if (!updateResult || updateResult.length === 0) {
        Logger.error('[FaithPointsService] Update returned no data - profile may not exist or RLS issue', undefined, {
      component: 'faithPointsService',
    });
        // Try to fetch the profile again to see current state
        const { data: afterUpdate } = await supabase
          .from('faith_points_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        // For onboarding, try to create profile if it doesn't exist
        if (isOnboarding && !afterUpdate) {

          await this.createUserProfile(userId);
          // Retry the points award
          return this.awardPoints(userId, activity, { ..._metadata, isOnboarding: false });
        }
      }

      // Record transaction AFTER profile update (non-blocking)
      try {
        await this.recordTransaction(userId, pointsAwarded, activity, _metadata);
        Logger.debug(`[FaithPointsService] Transaction recorded: ${activity} for ${pointsAwarded} points`, {
          component: 'faithPointsService',
          activity,
          points: pointsAwarded,
          userId,
        });
      } catch (transactionError) {
        Logger.error('[FaithPointsService] Transaction logging failed, but faith points were awarded', transactionError as Error, {
          component: 'faithPointsService',
          activity,
          points: pointsAwarded,
        });
        // Continue execution - don't let transaction logging failure block faith points
      }

      // Award bonus points for level up
      if (leveledUp) {
        await this.recordTransaction(userId, 50, 'achievement', { type: 'level_up', level: newLevel });

        // Record level-specific activities for badge tracking
        for (let level = currentLevel + 1; level <= newLevel; level++) {
          await this.recordTransaction(userId, 0, 'achievement', { type: `level_${level}_reached` });
        }

        // Show level up notification (unless suppressed)
        if (!_metadata?.suppressNotification) {
          notificationService.showPointsNotification(50, 'level_up', 'center');
        }
      }

      // Show points notification unless suppressed
      if (!_metadata?.suppressNotification) {

        notificationService.showPointsNotification(pointsAwarded, activity, 'center');
      } else {

      }

      // DEBUG: Log before any badge checking logic
      Logger.debug('[FaithPointsService] DEBUG: About to check badge conditions', {
        component: 'faithPointsService',
        userId,
        activity,
        suppressNotification: _metadata?.suppressNotification,
        totalPoints: newTotalPoints,
        timestamp: new Date().toISOString(),
      });

      // ENTERPRISE-GRADE: Defer badge checking with debouncing to prevent UI freeze and duplicates
      // Use lightweight queries and longer delay for critical operations
      if (!_metadata?.suppressNotification) {
        Logger.debug('[FaithPointsService] DEBUG: Badge checking not suppressed, setting up timer', {
          component: 'faithPointsService',
          userId,
          activity,
        });

        // Clear any existing timer for this user
        const existingTimer = FaithPointsService.badgeCheckTimers.get(userId);
        if (existingTimer) {
          Logger.debug('[FaithPointsService] DEBUG: Clearing existing timer', {
            component: 'faithPointsService',
            userId,
          });
          clearTimeout(existingTimer);
        }

        // CRITICAL FIX: Use setImmediate for React Native non-blocking execution
        // This ensures badge checking only runs when the UI is truly idle
        const scheduleBadgeCheck = () => {
          // React Native doesn't have requestIdleCallback, use setImmediate instead
          // setImmediate runs on the next tick of the event loop, making it truly non-blocking
          setImmediate(async () => {
            await this.performBadgeCheck(userId, newTotalPoints, activity, timer);
          });
        };

        // Enhanced debouncing for rapid completion scenarios
        const timer = setTimeout(() => {
          scheduleBadgeCheck();
        }, 3000); // INCREASED: 3000ms delay for rapid completion scenarios

        // Store timer reference for cleanup
        FaithPointsService.badgeCheckTimers.set(userId, timer);
      }

      Logger.debug('[FaithPointsService] BEFORE milestone check', {
        component: 'faithPointsService',
      });

      // Check for milestone celebrations (non-blocking)
      milestoneCelebrationService.checkFaithPointsMilestone(
        userId,
        profile.totalPoints,
        newTotalPoints
      ).catch((milestoneError) => {
        Logger.error('Failed to check faith points milestone', milestoneError as Error, {
          component: 'faithPointsService',
        });
      });

      Logger.debug('[FaithPointsService] AFTER milestone check', {
        component: 'faithPointsService',
      });

      // CRITICAL: Disable event emissions - they trigger expensive re-renders causing 7.6s freeze
      // Components will refetch data naturally via React Query
      // Only emit events if not suppressed to prevent duplicate UI updates
      if (!_metadata?.suppressNotification) {
        Logger.debug('[FaithPointsService] Events suppressed to prevent re-render freeze', {
          component: 'faithPointsService',
        });

        // DISABLED: These events cause components to re-render and freeze UI
        // setTimeout(() => {
        //   Logger.debug(`[FaithPointsService] 🔍 INSIDE setTimeout - emitting events`, {
        //     component: 'faithPointsService',
        //   });

        //   faithPointsEvents.emit(FAITH_POINTS_EVENTS.POINTS_UPDATED, {
        //     userId,
        //     pointsAwarded,
        //     totalPoints: newTotalPoints,
        //     level: newLevel,
        //   });

        //   if (leveledUp) {

        //     faithPointsEvents.emit(FAITH_POINTS_EVENTS.LEVEL_UP, {
        //       userId,
        //       newLevel,
        //       totalPoints: newTotalPoints,
        //     });
        //   }

        //   Logger.debug(`[FaithPointsService] 🔍 AFTER emitting events in setTimeout`, {
        //     component: 'faithPointsService',
        //   });
        // }, 100); // Small delay to ensure database transaction is complete

        Logger.debug('[FaithPointsService] Events disabled - components will refetch naturally', {
          component: 'faithPointsService',
        });
      } else {

      }

      Logger.debug('[FaithPointsService] BEFORE return statement', {
        component: 'faithPointsService',
        pointsAwarded,
        newLevel: leveledUp ? newLevel : undefined,
        badgeCount: newBadges?.length || 0,
      });

      return {
        pointsAwarded,
        newLevel: leveledUp ? newLevel : undefined,
        newBadges,
      };

    } catch (error) {
      Logger.error('[FaithPointsService] Error awarding points', error as Error, {
      component: 'faithPointsService',
    });
      return { pointsAwarded: 0 };
    }
  }

  /**
   * Get user's recent transactions
   */
  async getRecentTransactions(userId: string, limit: number = 10): Promise<FaithPointsTransaction[]> {
    try {
      const { data: transactions } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return transactions || [];
    } catch (error) {
      Logger.error('[FaithPointsService] Error getting transactions', error as Error, {
      component: 'faithPointsService',
    });
      return [];
    }
  }

  /**
   * Get available badges
   */
  async getAvailableBadges(): Promise<Badge[]> {
    try {
      Logger.debug('[FaithPointsService] DEBUG: getAvailableBadges starting', {
        component: 'faithPointsService',
        timestamp: new Date().toISOString(),
      });

      // Fetch badges from the actual badges table in database
      // OPTIMIZATION: Only fetch specific fields needed for badge checking
      const startTime = Date.now();
      const { data: badges, error } = await supabase
        .from('badges')
        .select('id, name, description, icon, rarity, faith_points_reward')
        .order('rarity, faith_points_reward');

      const queryTime = Date.now() - startTime;
      Logger.debug('[FaithPointsService] DEBUG: getAvailableBadges query completed', {
        component: 'faithPointsService',
        queryTime,
        badgeCount: badges?.length || 0,
        errorMessage: error?.message,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        Logger.error('[FaithPointsService] Error fetching badges from database', error, {
          component: 'faithPointsService',
        });
        // Fallback to hardcoded badges if database fails
        return this.getFallbackBadges();
      }

      if (!badges || badges.length === 0) {
        Logger.warn('[FaithPointsService] No badges found in database, using fallback', {
          component: 'faithPointsService',
        });
        return this.getFallbackBadges();
      }

      // Transform database badges to Badge interface
      return badges.map(badge => ({
        id: badge.id, // Keep UUID from database
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        rarity: badge.rarity as 'common' | 'rare' | 'epic' | 'legendary',
        pointsRequired: badge.faith_points_reward,
      }));
    } catch (error) {
      Logger.error('[FaithPointsService] Exception in getAvailableBadges', error as Error, {
        component: 'faithPointsService',
      });
      return this.getFallbackBadges();
    }
  }

  private getFallbackBadges(): Badge[] {
    return [
      // Playbook Generation Badges
      {
        id: 'first_playbook',
        name: 'First Steps',
        description: 'Generated your first playbook',
        icon: '🦶🏼',
        rarity: 'common',
        pointsRequired: 10,
      },
      {
        id: 'growth_seeker',
        name: 'Growth Seeker',
        description: 'Generated 25 playbooks',
        icon: '📈',
        rarity: 'rare',
        pointsRequired: 250,
      },
      {
        id: 'playbook_master',
        name: 'Playbook Master',
        description: 'Generated 50 playbooks',
        icon: '🌿',
        rarity: 'epic',
        pointsRequired: 500,
      },
      {
        id: 'playbook_legend',
        name: 'Playbook Legend',
        description: 'Generated 100 playbooks',
        icon: '🌳',
        rarity: 'legendary',
        pointsRequired: 1000,
      },

      // Devotional Badges
      {
        id: 'prayer_warrior',
        name: 'Prayer Warrior',
        description: 'Completed 25 prayer activities',
        icon: '🙏🏼',
        rarity: 'rare',
        pointsRequired: 80,
      },
      {
        id: 'faithful_witness',
        name: 'Faithful Witness',
        description: 'Documented 15 answered prayers',
        icon: '🕊️',
        rarity: 'rare',
        pointsRequired: 120,
      },
      {
        id: 'devotional_dedicated',
        name: 'Devotional Dedicated',
        description: 'Generated 25 devotionals',
        icon: '📿',
        rarity: 'epic',
        pointsRequired: 200,
      },
      {
        id: 'devotional_master',
        name: 'Devotional Master',
        description: 'Generated 50 devotionals',
        icon: '⛪',
        rarity: 'legendary',
        pointsRequired: 400,
      },

      // Journal Badges
      {
        id: 'journal_keeper',
        name: 'Journal Keeper',
        description: 'Made 50 journal entries',
        icon: '🤲🏼',
        rarity: 'epic',
        pointsRequired: 250,
      },
      {
        id: 'journal_scribe',
        name: 'Journal Scribe',
        description: 'Made 100 journal entries',
        icon: '📝',
        rarity: 'legendary',
        pointsRequired: 500,
      },

      // Streak Badges
      {
        id: 'consistent_week',
        name: 'Faithful Week',
        description: 'Used the app 7 days in a row',
        icon: '🔥',
        rarity: 'common',
        pointsRequired: 35,
      },
      {
        id: 'streak_warrior',
        name: 'Streak Warrior',
        description: '14-day streak',
        icon: '💪🏼',
        rarity: 'rare',
        pointsRequired: 70,
      },
      {
        id: 'streak_master',
        name: 'Streak Master',
        description: '30-day streak',
        icon: '🌟',
        rarity: 'epic',
        pointsRequired: 150,
      },
      {
        id: 'streak_legend',
        name: 'Streak Legend',
        description: '60-day streak',
        icon: '🏆',
        rarity: 'legendary',
        pointsRequired: 300,
      },

      // Level Achievement Badges
      {
        id: 'seeker',
        name: 'Seeker',
        description: 'Beginning your faith journey',
        icon: '🔍',
        rarity: 'common',
        pointsRequired: 0,
      },
      {
        id: 'believer',
        name: 'Believer',
        description: 'Growing in faith',
        icon: '🌱',
        rarity: 'common',
        pointsRequired: 100,
      },
      {
        id: 'disciple',
        name: 'Disciple',
        description: 'Committed to growth',
        icon: '⚡',
        rarity: 'rare',
        pointsRequired: 300,
      },
      {
        id: 'servant',
        name: 'Servant',
        description: 'Serving others',
        icon: '🤲🏼',
        rarity: 'rare',
        pointsRequired: 600,
      },
      {
        id: 'leader',
        name: 'Leader',
        description: 'Leading by example',
        icon: '👑',
        rarity: 'legendary',
        pointsRequired: 1000,
      },
      {
        id: 'teacher',
        name: 'Teacher',
        description: 'Sharing wisdom',
        icon: '📚',
        rarity: 'legendary',
        pointsRequired: 1500,
      },
      {
        id: 'mentor',
        name: 'Mentor',
        description: 'Guiding others',
        icon: '🎯',
        rarity: 'legendary',
        pointsRequired: 2500,
      },
      {
        id: 'elder',
        name: 'Elder',
        description: 'Wise in faith',
        icon: '🦉',
        rarity: 'legendary',
        pointsRequired: 4000,
      },
      {
        id: 'steward',
        name: 'Steward',
        description: 'Faithful steward of God\'s gifts',
        icon: '🌾',
        rarity: 'legendary',
        pointsRequired: 6000,
      },
      {
        id: 'ambassador',
        name: 'Ambassador',
        description: 'Spreading the faith',
        icon: '🌍',
        rarity: 'legendary',
        pointsRequired: 10000,
      },
    ];
  }

  /**
   * Retroactively award level badges for existing users
   */
  async retroactivelyAwardLevelBadges(userId: string): Promise<void> {
    try {
      // Get user's current level
      const { data: profile } = await supabase
        .from('faith_points_profiles')
        .select('current_level')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        Logger.warn('[FaithPointsService] No profile found for retroactive badge awarding', {
          component: 'faithPointsService',
          userId,
        });
        return;
      }

      const currentLevel = profile.current_level || 1;
      Logger.info('[FaithPointsService] Retroactively awarding badges for level', {
        component: 'faithPointsService',
        userId,
        currentLevel,
      });

      // Get all available badges
      const allBadges = await this.getAvailableBadges();

      // Award badges for all levels up to current level
      for (let level = 1; level <= currentLevel; level++) {
        const levelBadgeName = this.getLevelBadgeName(level);
        const badge = allBadges.find(b => b.name === levelBadgeName);

        if (badge) {
          // Record the level reached activity if it doesn't exist
          await this.recordTransaction(userId, 0, 'achievement', { type: `level_${level}_reached` });

          // Try to award the badge
          await this.awardBadge(userId, badge);
        }
      }

      Logger.info('[FaithPointsService] Retroactive badge awarding completed', {
        component: 'faithPointsService',
        userId,
        levelsProcessed: currentLevel,
      });
    } catch (error) {
      Logger.error('[FaithPointsService] Error in retroactive badge awarding', error as Error, {
        component: 'faithPointsService',
        userId,
      });
    }
  }

  private getLevelBadgeName(level: number): string {
    const levelNames: { [key: number]: string } = {
      1: 'Seeker',
      2: 'Believer',
      3: 'Disciple',
      4: 'Servant',
      5: 'Leader',
      6: 'Teacher',
      7: 'Mentor',
      8: 'Elder',
      9: 'Steward',
      10: 'Ambassador',
    };
    return levelNames[level] || 'Seeker';
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
      Logger.error('[FaithPointsService] Error getting achievements', error as Error, {
      component: 'faithPointsService',
    });
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

      // Award the Seeker badge immediately for new users
      // This prevents the badge from being re-awarded later when points are earned
      try {
        const seekerBadge = (await this.getAvailableBadges()).find(b => b.id === 'seeker');
        if (seekerBadge) {
          await this.awardBadge(userId, seekerBadge);
          // Record the level_1_reached event for badge tracking
          await this.recordTransaction(userId, 0, 'achievement', { type: 'level_1_reached' });
          Logger.info('[FaithPointsService] Seeker badge awarded to new user', {
            component: 'faithPointsService',
            userId,
          });
        }
      } catch (badgeError) {
        Logger.warn('[FaithPointsService] Failed to award Seeker badge to new user', {
          error: badgeError as Error,
          component: 'faithPointsService',
          userId,
        });
        // Continue even if badge awarding fails
      }

      return newProfile;

    } catch (error) {
      Logger.error('[FaithPointsService] Error creating profile', error as Error, {
      component: 'faithPointsService',
    });
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
      // Try manual SQL query to bypass schema cache
      const manualQuery = `
        INSERT INTO faith_points_log (user_id, points, activity_type, reason, metadata, created_at)
        VALUES ('${userId}', ${points}, '${reason}', '${this.getCategoryFromReason(reason)}', ${metadata ? `'${JSON.stringify(metadata)}'` : 'NULL'}, NOW())
        RETURNING *;
      `;

      const { error: manualError } = await supabase
        .rpc('execute_sql', { query: manualQuery });

      if (manualError) {

        // Try the simplest possible insert
        const { error } = await supabase
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
          Logger.error('[FaithPointsService] All insert methods failed', error as Error, {
      component: 'faithPointsService',
    });
          // Don't throw error, just log it so faith points awarding continues

          return;
        }

        return;
      }

      return;
    } catch (error) {
      Logger.error('[FaithPointsService] Error recording transaction', error as Error, {
      component: 'faithPointsService',
    });
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
      Logger.error('[FaithPointsService] Error updating streak', error as Error, {
      component: 'faithPointsService',
    });
      return 1;
    }
  }

  /**
   * Check for new badges earned
   */
  private async performBadgeCheck(
    userId: string,
    totalPoints: number,
    activity: string,
    timer: NodeJS.Timeout
  ): Promise<void> {
    try {
      // Clean up timer reference
      FaithPointsService.badgeCheckTimers.delete(userId);

      Logger.debug('[FaithPointsService] DEBUG: Timer fired, starting deferred badge check', {
        component: 'faithPointsService',
        userId,
        activity,
        totalPoints: totalPoints,
        timestamp: new Date().toISOString(),
      });

      // CRITICAL: Check if this timer is still valid (not superseded by newer activity)
      const currentTimer = FaithPointsService.badgeCheckTimers.get(userId);
      if (currentTimer !== timer) {
        Logger.debug('[FaithPointsService] DEBUG: Timer superseded by newer activity, skipping badge check', {
          component: 'faithPointsService',
          userId,
        });
        return;
      }

      // Now check for badges asynchronously (non-blocking)
      const deferredBadges = await this.checkForNewBadges(userId, totalPoints, activity);

      if (deferredBadges && deferredBadges.length > 0) {
        Logger.debug(`[FaithPointsService] Deferred badge check complete - Count: ${deferredBadges.length}`, {
          component: 'faithPointsService',
          badgeCount: deferredBadges.length,
        });

        // Process each badge with additional non-blocking delays
        const badgePromises = deferredBadges.map(async (badge, index) => {
          // Add staggered delays to prevent database overload
          await new Promise(resolve => setTimeout(resolve, index * 200));

          Logger.debug(`[FaithPointsService] Badge unlocked (deferred): ${badge.name}`, {
            component: 'faithPointsService',
            badgeId: badge.id,
            userId,
          });

          // Show badge notification
          notificationService.showBadgeNotification(badge);

          // Save badge to database (using awardBadge method which has correct schema)
          try {
            Logger.debug(`[FaithPointsService] Awarding badge: ${badge.name} (ID: ${badge.id})`, {
              component: 'faithPointsService',
              userId,
              badgeId: badge.id,
              badgeName: badge.name,
            });
            await this.awardBadge(userId, badge);
          } catch (saveErr) {
            Logger.error('[FaithPointsService] Exception saving badge to database (deferred)', saveErr as Error, {
              component: 'faithPointsService',
              badgeId: badge.id,
            });
          }

          // CRITICAL: Re-enable badge events but defer them to prevent freeze
          // Profile screen needs BADGE_UNLOCKED events to update badge count
          setTimeout(() => {
            faithPointsEvents.emit(FAITH_POINTS_EVENTS.BADGE_UNLOCKED, {
              userId,
              badge,
            });
          }, 500); // Increased delay to ensure database write completes

          // Award bonus points for badge unlock (non-blocking)
          return this.recordTransaction(userId, badge.pointsRequired, 'achievement', {
            type: 'badge_unlocked',
            badgeId: badge.id,
            badgeName: badge.name,
          }).catch(err => {
            Logger.error('[FaithPointsService] Failed to record badge transaction', err as Error, {
              component: 'faithPointsService',
              badgeId: badge.id,
            });
          });
        });

        Promise.all(badgePromises).catch(err => {
          Logger.error('[FaithPointsService] Failed to process badges', err as Error, {
            component: 'faithPointsService',
          });
        });
      }
    } catch (badgeCheckError) {
      Logger.error('[FaithPointsService] Failed to check badges (deferred)', badgeCheckError as Error, {
        component: 'faithPointsService',
      });
    }
  }

  private async checkForNewBadges(
    userId: string,
    totalPoints: number,
    activity: string
  ): Promise<Badge[]> {
    try {
      const availableBadges = await this.getAvailableBadges();
      const userBadges = await this.getUserBadges(userId);
      const userBadgeNames = userBadges.map(b => b.name); // Use names for comparison

      Logger.debug(`[FaithPointsService] Badge check started - Available: ${availableBadges.length}, User has: ${userBadges.length}`, {
        component: 'faithPointsService',
        availableBadgeNames: availableBadges.map(b => b.name),
        userBadgeNames,
      });

      const newBadges: Badge[] = [];

      // Pre-fetch activity counts to avoid multiple database calls
      let activityCounts: Record<string, number> = {};
      const hasActivityBasedBadges = availableBadges.some(badge =>
        ['First Steps', 'Growth Seeker', 'Playbook Master', 'Playbook Legend',
         'Prayer Warrior', 'Devotional Dedicated', 'Devotional Master',
         'Journal Keeper', 'Journal Scribe',
         'Faithful Week', 'Streak Warrior', 'Streak Master', 'Streak Legend'].includes(badge.name)
      );

      if (hasActivityBasedBadges) {
        Logger.debug('[FaithPointsService] DEBUG: Fetching activity counts', {
          component: 'faithPointsService',
          userId,
          timestamp: new Date().toISOString(),
        });

        // Batch fetch all relevant activity counts in one query
        const startTime = Date.now();
        const { data: transactions } = await supabase
          .from('faith_points_transactions')
          .select('activity_type')
          .eq('user_id', userId);

        const queryTime = Date.now() - startTime;
        Logger.debug('[FaithPointsService] DEBUG: Activity counts query completed', {
          component: 'faithPointsService',
          userId,
          queryTime,
          transactionCount: transactions?.length || 0,
          timestamp: new Date().toISOString(),
        });

        if (transactions) {
          activityCounts = transactions.reduce((counts, t) => {
            counts[t.activity_type] = (counts[t.activity_type] || 0) + 1;
            return counts;
          }, {} as Record<string, number>);
        }
      }

      for (const badge of availableBadges) {
        if (!userBadgeNames.includes(badge.name)) { // Compare by name, not ID
          // For activity-based badges, use pre-fetched counts
          const isActivityBasedBadge = [
            'First Steps', 'Growth Seeker', 'Playbook Master', 'Playbook Legend',
            'Prayer Warrior', 'Devotional Dedicated', 'Devotional Master',
            'Journal Keeper', 'Journal Scribe',
            'Faithful Week', 'Streak Warrior', 'Streak Master', 'Streak Legend',
          ].includes(badge.name);

          const pointsRequirementMet = totalPoints >= badge.pointsRequired;

          // Quick check using pre-fetched counts
          if (isActivityBasedBadge) {
            const earned = await this.checkBadgeRequirementWithCounts(userId, badge, activity, activityCounts);
            if (earned) {
              newBadges.push(badge);
              // NOTE: Don't award here - awarding happens in deferred processing
            }
          } else if (pointsRequirementMet) {
            // For point-based badges, just check points (no database calls needed)
            newBadges.push(badge);
            // NOTE: Don't award here - awarding happens in deferred processing
          }
        }
      }

      return newBadges;

    } catch (error) {
      Logger.error('[FaithPointsService] Error checking badges', error as Error, {
      component: 'faithPointsService',
    });
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
      Logger.debug('[FaithPointsService] DEBUG: getUserBadges starting', {
        component: 'faithPointsService',
        userId,
        timestamp: new Date().toISOString(),
      });

      // PERFORMANCE FIX: Lightweight join to get only badge names
      // We need names for comparison since available badges use names
      const startTime = Date.now();
      const { data: userBadgeRecords, error } = await supabase
        .from('user_badges')
        .select('badge_id, badges!inner(name)')
        .eq('user_id', userId);

      const queryTime = Date.now() - startTime;
      Logger.debug('[FaithPointsService] DEBUG: getUserBadges query completed', {
        component: 'faithPointsService',
        userId,
        queryTime,
        recordCount: userBadgeRecords?.length || 0,
        errorMessage: error?.message,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        Logger.error('[FaithPointsService] Error fetching user badges', error as Error, {
          component: 'faithPointsService',
          userId,
        });
        return [];
      }

      // Return minimal Badge objects with names for duplicate checking
      const badges: Badge[] = (userBadgeRecords || [])
        .filter(record => record.badges)
        .map(record => ({
          id: record.badge_id,
          name: (record.badges as any).name || '',
          description: '',
          icon: '',
          rarity: 'common' as const,
          pointsRequired: 0,
        }));

      Logger.debug(`[FaithPointsService] Found ${badges.length} badges for user`, {
        component: 'faithPointsService',
        userId,
        badgeNames: badges.map(b => b.name),
      });

      return badges;
    } catch (error) {
      Logger.error('[FaithPointsService] Exception getting user badges', error as Error, {
        component: 'faithPointsService',
        userId,
      });
      return [];
    }
  }

  private async checkBadgeRequirementWithCounts(userId: string, badge: Badge, activity: string, activityCounts: Record<string, number>): Promise<boolean> {
    // Use pre-fetched counts to avoid database calls
    switch (badge.name) {
      // Playbook Generation Badges
      case 'First Steps':
        // Award only on the first playbook generation (count should be 0 before this one)
        const currentCount = activityCounts.playbook_generated || 0;
        return activity === 'playbook_generated' && currentCount === 0;

      case 'Growth Seeker':
        // Award after generating 25 playbooks - ONLY check during playbook generation
        if (activity !== 'playbook_generated') { return false; }
        return (activityCounts.playbook_generated || 0) >= 25;

      case 'Playbook Master':
        // Award after generating 50 playbooks - ONLY check during playbook generation
        if (activity !== 'playbook_generated') { return false; }
        return (activityCounts.playbook_generated || 0) >= 50;

      case 'Playbook Legend':
        // Award after generating 100 playbooks - ONLY check during playbook generation
        if (activity !== 'playbook_generated') { return false; }
        return (activityCounts.playbook_generated || 0) >= 100;

      // Devotional Badges
      case 'Prayer Warrior':
        // Award after completing 25 prayer activities - ONLY check during prayer activities
        if (!activity.includes('prayer')) { return false; }
        const devotionalPrayersCount = activityCounts.prayer_devotional_prayed || 0;
        const prayerListPrayedCount = activityCounts.prayer_list_prayed || 0;
        const totalPrayerActivities = devotionalPrayersCount + prayerListPrayedCount;
        return totalPrayerActivities >= 25;

      case 'Faithful Witness':
        // Award after documenting 15 answered prayers - ONLY check during prayer activities
        if (activity !== 'prayer_answered') { return false; }
        return (activityCounts.prayer_answered || 0) >= 15;

      case 'Devotional Dedicated':
        // Award after generating 25 devotionals - ONLY check during devotional generation
        if (activity !== 'devotional_generated') { return false; }
        return (activityCounts.devotional_generated || 0) >= 25;

      case 'Devotional Master':
        // Award after generating 50 devotionals - ONLY check during devotional generation
        if (activity !== 'devotional_generated') { return false; }
        return (activityCounts.devotional_generated || 0) >= 50;

      // Journal Badges
      case 'Journal Keeper':
        // Award after making 50 journal entries - ONLY check during journal activities
        if (!activity.includes('journal')) { return false; }
        return (activityCounts.journal_entry || 0) >= 50;

      case 'Journal Scribe':
        // Award after making 100 journal entries - ONLY check during journal activities
        if (!activity.includes('journal')) { return false; }
        return (activityCounts.journal_entry || 0) >= 100;

      // Streak Badges
      case 'Faithful Week':
        // Award after 7-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return (activityCounts.daily_streak || 0) >= 7;

      case 'Streak Warrior':
        // Award after 14-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return (activityCounts.daily_streak || 0) >= 14;

      case 'Streak Master':
        // Award after 30-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return (activityCounts.daily_streak || 0) >= 30;

      case 'Streak Legend':
        // Award after 60-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return (activityCounts.daily_streak || 0) >= 60;

      // Level Achievement Badges
      case 'Seeker':
        // Award after reaching level 1 - ONLY check during achievement/level activities
        // This is given automatically to new users in createUserProfile
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_1_reached || 0) >= 1;

      case 'Believer':
        // Award after reaching level 2 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_2_reached || 0) >= 1;

      case 'Disciple':
        // Award after reaching level 3 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_3_reached || 0) >= 1;

      case 'Servant':
        // Award after reaching level 4 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_4_reached || 0) >= 1;

      case 'Leader':
        // Award after reaching level 5 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_5_reached || 0) >= 1;

      case 'Teacher':
        // Award after reaching level 6 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_6_reached || 0) >= 1;

      case 'Mentor':
        // Award after reaching level 7 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_7_reached || 0) >= 1;

      case 'Elder':
        // Award after reaching level 8 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_8_reached || 0) >= 1;

      case 'Steward':
        // Award after reaching level 9 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_9_reached || 0) >= 1;

      case 'Ambassador':
        // Award after reaching level 10 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return (activityCounts.level_10_reached || 0) >= 1;

      default:
        return false;
    }
  }

  private async checkBadgeRequirement(userId: string, badge: Badge, activity: string): Promise<boolean> {
    // Implement specific badge requirement checks using badge names instead of IDs
    // This works because badge names are unique and stable
    switch (badge.name) {
      // Playbook Generation Badges
      case 'First Steps':
        // Award only on the first playbook generation (count should be 0 before this one)
        const currentCount = await this.getActivityCount(userId, 'playbook_generated');
        return activity === 'playbook_generated' && currentCount === 0;

      case 'Growth Seeker':
        // Award after generating 25 playbooks - ONLY check during playbook generation
        if (activity !== 'playbook_generated') { return false; }
        return await this.getActivityCount(userId, 'playbook_generated') >= 25;

      case 'Playbook Master':
        // Award after generating 50 playbooks - ONLY check during playbook generation
        if (activity !== 'playbook_generated') { return false; }
        return await this.getActivityCount(userId, 'playbook_generated') >= 50;

      case 'Playbook Legend':
        // Award after generating 100 playbooks - ONLY check during playbook generation
        if (activity !== 'playbook_generated') { return false; }
        return await this.getActivityCount(userId, 'playbook_generated') >= 100;

      // Devotional Badges
      case 'Prayer Warrior':
        // Award after completing 25 prayer activities - ONLY check during prayer activities
        if (!activity.includes('prayer')) {return false;}
        const devotionalPrayersCount = await this.getActivityCount(userId, 'prayer_devotional_prayed');
        const prayerListPrayedCount = await this.getActivityCount(userId, 'prayer_list_prayed');
        const totalPrayerActivities = devotionalPrayersCount + prayerListPrayedCount;
        return totalPrayerActivities >= 25;

      case 'Faithful Witness':
        // Award after documenting 15 answered prayers - ONLY check during prayer activities
        if (activity !== 'prayer_answered') { return false; }
        return await this.getActivityCount(userId, 'prayer_answered') >= 15;

      case 'Devotional Dedicated':
        // Award after generating 25 devotionals - ONLY check during devotional generation
        if (activity !== 'devotional_generated') { return false; }
        return await this.getActivityCount(userId, 'devotional_generated') >= 25;

      case 'Devotional Master':
        // Award after generating 50 devotionals - ONLY check during devotional generation
        if (activity !== 'devotional_generated') { return false; }
        return await this.getActivityCount(userId, 'devotional_generated') >= 50;

      // Journal Badges
      case 'Journal Keeper':
        // Award after making 50 journal entries - ONLY check during journal activities
        if (!activity.includes('journal')) { return false; }
        return await this.getActivityCount(userId, 'journal_entry') >= 50;

      case 'Journal Scribe':
        // Award after making 100 journal entries - ONLY check during journal activities
        if (!activity.includes('journal')) { return false; }
        return await this.getActivityCount(userId, 'journal_entry') >= 100;

      // Streak Badges
      case 'Faithful Week':
        // Award after 7-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return await this.getActivityCount(userId, 'daily_streak') >= 7;

      case 'Streak Warrior':
        // Award after 14-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return await this.getActivityCount(userId, 'daily_streak') >= 14;

      case 'Streak Master':
        // Award after 30-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return await this.getActivityCount(userId, 'daily_streak') >= 30;

      case 'Streak Legend':
        // Award after 60-day streak - ONLY check during streak-related activities
        if (!activity.includes('streak') && !activity.includes('daily')) { return false; }
        return await this.getActivityCount(userId, 'daily_streak') >= 60;

      // Level Achievement Badges
      case 'Seeker':
        // Award after reaching level 1 - ONLY check during achievement/level activities
        // This is given automatically to new users in createUserProfile
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_1_reached') >= 1;

      case 'Believer':
        // Award after reaching level 2 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_2_reached') >= 1;

      case 'Disciple':
        // Award after reaching level 3 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_3_reached') >= 1;

      case 'Servant':
        // Award after reaching level 4 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_4_reached') >= 1;

      case 'Leader':
        // Award after reaching level 5 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_5_reached') >= 1;

      case 'Teacher':
        // Award after reaching level 6 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_6_reached') >= 1;

      case 'Mentor':
        // Award after reaching level 7 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_7_reached') >= 1;

      case 'Elder':
        // Award after reaching level 8 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_8_reached') >= 1;

      case 'Steward':
        // Award after reaching level 9 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_9_reached') >= 1;

      case 'Ambassador':
        // Award after reaching level 10 - ONLY check during achievement/level activities
        if (activity !== 'achievement' && !activity.includes('level')) { return false; }
        return await this.getActivityCount(userId, 'level_10_reached') >= 1;

      default:
        return false;
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
      // ENTERPRISE-GRADE: In-memory guard prevents race conditions
      // Check if this badge is currently being awarded to prevent duplicates
      if (!FaithPointsService.badgesBeingAwarded.has(userId)) {
        FaithPointsService.badgesBeingAwarded.set(userId, new Set());
      }

      const userBadges = FaithPointsService.badgesBeingAwarded.get(userId)!;
      if (userBadges.has(badge.name)) {
        Logger.info('[FaithPointsService] Badge currently being awarded (race condition prevented)', {
          component: 'faithPointsService',
          badgeName: badge.name,
          userId,
        });
        return;
      }

      // Mark badge as being awarded
      userBadges.add(badge.name);

      try {
        // PREVENT DUPLICATES: Check if user already has this badge
        // First get the badge UUID from badges table
        const { data: badgeRecord, error: lookupError } = await supabase
          .from('badges')
          .select('id')
          .eq('name', badge.name)
          .single();

        if (lookupError || !badgeRecord) {
          Logger.error('[FaithPointsService] Badge not found in badges table', lookupError as Error, {
            component: 'faithPointsService',
            badgeName: badge.name,
            badgeId: badge.id,
            errorDetails: lookupError,
          });
          return;
        }

        // Now check if user already has this badge in database
        const { data: existingBadge } = await supabase
          .from('user_badges')
          .select('id')
          .eq('user_id', userId)
          .eq('badge_id', badgeRecord.id)
          .single();

        if (existingBadge) {
          Logger.info('[FaithPointsService] Badge already exists for user (database check), skipping award', {
            component: 'faithPointsService',
            badgeId: badgeRecord.id,
            badgeName: badge.name,
          });
          return;
        }

      // Insert with the actual UUID from badges table
      const { error: insertError } = await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badgeRecord.id, // Use UUID from badges table
          earned_at: new Date().toISOString(),
        });

      if (insertError) {
        // Check if it's a duplicate key error (badge already awarded)
        if (insertError.code === '23505') {
          Logger.info('[FaithPointsService] Badge already awarded to user', {
            component: 'faithPointsService',
            badgeId: badgeRecord.id,
            badgeName: badge.name,
          });
          return;
        }

        Logger.error('[FaithPointsService] Failed to save badge to database', insertError as Error, {
          component: 'faithPointsService',
          badgeId: badgeRecord.id,
          badgeName: badge.name,
          errorDetails: insertError,
        });
        throw insertError;
      }

      Logger.info('[FaithPointsService] Badge awarded successfully', {
        component: 'faithPointsService',
        badgeId: badgeRecord.id,
        badgeName: badge.name,
      });

      // Emit BADGE_UNLOCKED event to update badge count in profile
        setTimeout(() => {
          faithPointsEvents.emit(FAITH_POINTS_EVENTS.BADGE_UNLOCKED, {
            userId,
            badge,
          });
        }, 300); // Small delay to ensure database write completes

      } catch (innerError) {
        Logger.error('[FaithPointsService] Error in badge insertion', innerError as Error, {
          component: 'faithPointsService',
          badgeId: badge.id,
          badgeName: badge.name,
        });
        throw innerError;
      } finally {
        // ENTERPRISE-GRADE: Always clean up the guard, even on error
        // Remove badge from the "being awarded" set
        userBadges.delete(badge.name);

        // Clean up empty sets to prevent memory leaks
        if (userBadges.size === 0) {
          FaithPointsService.badgesBeingAwarded.delete(userId);
        }
      }
    } catch (error) {
      Logger.error('[FaithPointsService] Error awarding badge', error as Error, {
        component: 'faithPointsService',
        badgeId: badge.id,
        badgeName: badge.name,
      });
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
