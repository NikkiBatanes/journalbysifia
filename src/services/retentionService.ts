/**
 * Retention Service for Access Tiers System
 * Handles discount modals and retention offers for users
 */

import { supabase } from './supabaseClient';

export interface RetentionOffer {
  discount: number; // percentage discount
  duration: 'first_month' | 'first_year';
  message: string;
  title: string;
  cta: string;
  userValueScore: number;
  pricingStrategy: 'static' | 'dynamic' | 'urgency' | 'feature_focused';
  testGroup?: string;
  originalPrice: number;
  discountedPrice: number;
}

export interface RetentionEvent {
  id?: string;
  user_id: string;
  event_type: 'trial_declined' | 'trial_cancelled' | 'subscription_cancelled';
  triggered_at: string;
  modal_shown: boolean;
  action_taken?: 'accepted' | 'declined' | 'ignored';
  discount_offered: number;
}

export interface UserValueScore {
  engagementLevel: number; // 0-30 points
  subscriptionHistory: number; // 0-25 points
  contentCreation: number; // 0-20 points
  socialValue: number; // 0-15 points
  spiritualGrowth: number; // 0-10 points
  totalScore: number; // 0-100 points
}

export interface DynamicPricingConfig {
  baseDiscounts: {
    highValue: number; // 80+ points
    mediumValue: number; // 50-79 points
    lowValue: number; // 0-49 points
  };
  timingBonuses: {
    immediate: number; // 0-24 hours
    shortTerm: number; // 1-7 days
    mediumTerm: number; // 8-30 days
    longTerm: number; // 30+ days
  };
  tierMultipliers: {
    basic: number;
    starter: number;
    growth: number;
    transformation: number;
    family: number;
  };
}

export class RetentionService {
  private supabase = supabase;
  
  // Dynamic pricing configuration
  private dynamicPricingConfig: DynamicPricingConfig = {
    baseDiscounts: {
      highValue: 10, // High-value users get smaller discounts (they're more likely to stay)
      mediumValue: 20, // Standard discount
      lowValue: 30, // Higher discount to win back low-engagement users
    },
    timingBonuses: {
      immediate: 0, // No bonus for immediate offers
      shortTerm: 5, // +5% after 1-7 days
      mediumTerm: 10, // +10% after 8-30 days
      longTerm: 15, // +15% for win-back campaigns (30+ days)
    },
    tierMultipliers: {
      basic: 1.5, // Higher discounts for basic users
      starter: 1.2, // Moderate increase
      growth: 1.0, // Standard rate
      transformation: 0.8, // Lower discounts (premium users)
      family: 0.7, // Lowest discounts (highest value)
    },
  };

  /**
   * Check if user should see retention modal for given event
   */
  async checkRetentionTrigger(userId: string, eventType: 'trial_declined' | 'trial_cancelled' | 'subscription_cancelled'): Promise<boolean> {
    try {
      // Check if user already saw modal for this event in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await this.supabase
        .from('retention_events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', eventType)
        .gte('triggered_at', thirtyDaysAgo.toISOString())
        .order('triggered_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[RetentionService] Error checking retention trigger:', error);
        return false;
      }

      // If no recent event, show modal
      if (!data || data.length === 0) {
        // Log the trigger event
        await this.logRetentionEvent(userId, eventType, 'triggered');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RetentionService] Error in checkRetentionTrigger:', error);
      return false;
    }
  }

  /**
   * Calculate user value score based on behavior and history
   */
  async calculateUserValueScore(userId: string): Promise<UserValueScore> {
    try {
      // Get user data from multiple sources
      const [subscription, usage, profile] = await Promise.all([
        this.getUserSubscriptionData(userId),
        this.getUserUsageData(userId),
        this.getUserProfileData(userId),
      ]);

      // Calculate engagement level (0-30 points)
      const engagementLevel = this.calculateEngagementScore(usage, profile);
      
      // Calculate subscription history (0-25 points)
      const subscriptionHistory = this.calculateSubscriptionHistoryScore(subscription);
      
      // Calculate content creation (0-20 points)
      const contentCreation = this.calculateContentCreationScore(usage);
      
      // Calculate social value (0-15 points)
      const socialValue = this.calculateSocialValueScore(subscription, profile);
      
      // Calculate spiritual growth (0-10 points)
      const spiritualGrowth = this.calculateSpiritualGrowthScore(profile);
      
      const totalScore = engagementLevel + subscriptionHistory + contentCreation + socialValue + spiritualGrowth;

      return {
        engagementLevel,
        subscriptionHistory,
        contentCreation,
        socialValue,
        spiritualGrowth,
        totalScore: Math.min(100, totalScore), // Cap at 100
      };
    } catch (error) {
      console.error('[RetentionService] Error calculating user value score:', error);
      // Return default medium-value score on error
      return {
        engagementLevel: 15,
        subscriptionHistory: 12,
        contentCreation: 10,
        socialValue: 7,
        spiritualGrowth: 5,
        totalScore: 49,
      };
    }
  }

  /**
   * Get dynamic retention offer based on user value and timing
   */
  async getDynamicRetentionOffer(
    userId: string,
    eventType: 'trial_declined' | 'trial_cancelled' | 'subscription_cancelled',
    originalPrice: number,
    currentTier: string,
    daysSinceEvent: number = 0
  ): Promise<RetentionOffer> {
    try {
      // Calculate user value score
      const userValueScore = await this.calculateUserValueScore(userId);
      
      // Determine base discount based on user value
      let baseDiscount: number;
      if (userValueScore.totalScore >= 80) {
        baseDiscount = this.dynamicPricingConfig.baseDiscounts.highValue;
      } else if (userValueScore.totalScore >= 50) {
        baseDiscount = this.dynamicPricingConfig.baseDiscounts.mediumValue;
      } else {
        baseDiscount = this.dynamicPricingConfig.baseDiscounts.lowValue;
      }

      // Add timing bonus
      let timingBonus = 0;
      if (daysSinceEvent >= 30) {
        timingBonus = this.dynamicPricingConfig.timingBonuses.longTerm;
      } else if (daysSinceEvent >= 8) {
        timingBonus = this.dynamicPricingConfig.timingBonuses.mediumTerm;
      } else if (daysSinceEvent >= 1) {
        timingBonus = this.dynamicPricingConfig.timingBonuses.shortTerm;
      } else {
        timingBonus = this.dynamicPricingConfig.timingBonuses.immediate;
      }

      // Apply tier multiplier
      const tierMultiplier = this.dynamicPricingConfig.tierMultipliers[currentTier as keyof typeof this.dynamicPricingConfig.tierMultipliers] || 1.0;
      
      // Calculate final discount
      const finalDiscount = Math.min(50, Math.round((baseDiscount + timingBonus) * tierMultiplier));
      
      // Calculate pricing
      const discountAmount = Math.round(originalPrice * (finalDiscount / 100));
      const discountedPrice = originalPrice - discountAmount;

      // Generate personalized message
      const { title, message, cta } = this.generatePersonalizedMessage(eventType, finalDiscount, userValueScore, daysSinceEvent);

      return {
        discount: finalDiscount,
        duration: 'first_month',
        title,
        message,
        cta,
        userValueScore: userValueScore.totalScore,
        pricingStrategy: 'dynamic',
        testGroup: 'dynamic_pricing_v1',
        originalPrice,
        discountedPrice,
      };
    } catch (error) {
      console.error('[RetentionService] Error generating dynamic offer:', error);
      // Fallback to static offer
      return this.getStaticRetentionOffer(eventType, originalPrice);
    }
  }

  /**
   * Get static retention offer (fallback)
   */
  getStaticRetentionOffer(eventType: 'trial_declined' | 'trial_cancelled' | 'subscription_cancelled', originalPrice: number = 999): RetentionOffer {
    const discountAmount = Math.round(originalPrice * 0.2); // 20% discount
    const discountedPrice = originalPrice - discountAmount;

    const offers: Record<string, RetentionOffer> = {
      'trial_declined': {
        discount: 20, // Additional 20% off as specified
        duration: 'first_month',
        title: "Don't miss out on your spiritual growth",
        message: "Get 20% off your first month and continue your faith journey",
        cta: "Get 20% Off Now",
        userValueScore: 50, // Default medium value
        pricingStrategy: 'static',
        testGroup: 'static_offer_v1',
        originalPrice,
        discountedPrice,
      },
      'trial_cancelled': {
        discount: 20,
        duration: 'first_month',
        title: "We'd love to have you back",
        message: "Return to your spiritual practice with 20% off your first month",
        cta: "Come Back (20% Off)",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_offer_v1',
        originalPrice,
        discountedPrice,
      },
      'subscription_cancelled': {
        discount: 20,
        duration: 'first_month',
        title: "Your spiritual journey doesn't have to end",
        message: "Restart your subscription with 20% off and continue growing in faith",
        cta: "Restart Journey (20% Off)",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_offer_v1',
        originalPrice,
        discountedPrice,
      },
    };

    // Annual offers with higher discounts
    const annualOffers: Record<string, RetentionOffer> = {
      'trial_declined': {
        discount: 20,
        duration: 'first_year',
        title: "Commit to your spiritual growth",
        message: "Get 20% off your entire first year with our annual plan",
        cta: "Get Annual Discount",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_annual_v1',
        originalPrice,
        discountedPrice,
      },
      'trial_cancelled': {
        discount: 20,
        duration: 'first_year',
        title: "A year of spiritual transformation awaits",
        message: "Come back with 20% off your first year of spiritual growth",
        cta: "Start Annual Plan",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_annual_v1',
        originalPrice,
        discountedPrice,
      },
      'subscription_cancelled': {
        discount: 20,
        duration: 'first_year',
        title: "Recommit to your faith journey",
        message: "Get 20% off a full year and deepen your spiritual practice",
        cta: "Annual Plan (20% Off)",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_annual_v1',
        originalPrice,
        discountedPrice,
      },
    };

    // Return monthly offer by default, could be enhanced with A/B testing
    return offers[eventType] || offers['trial_declined'];
  }

  /**
   * Get retention offer for annual plans
   */
  getAnnualRetentionOffer(eventType: 'trial_declined' | 'trial_cancelled' | 'subscription_cancelled'): RetentionOffer {
    const offers: Record<string, RetentionOffer> = {
      'trial_declined': {
        discount: 20, // Additional 20% off first year
        duration: 'first_year',
        title: "Commit to your spiritual growth",
        message: "Get 20% off your entire first year with our annual plan",
        cta: "Get Annual Discount",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_annual_v1',
        originalPrice: 999,
        discountedPrice: 799,
      },
      'trial_cancelled': {
        discount: 20, // Additional 20% off first year
        duration: 'first_year',
        title: "A year of spiritual transformation awaits",
        message: "Come back with 20% off your first year of spiritual growth",
        cta: "Start Annual Plan",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_annual_v1',
        originalPrice: 999,
        discountedPrice: 799,
      },
      'subscription_cancelled': {
        discount: 20, // Additional 20% off first year
        duration: 'first_year',
        title: "Recommit to your faith journey",
        message: "Get 20% off a full year and deepen your spiritual practice",
        cta: "Annual Plan (20% Off)",
        userValueScore: 50,
        pricingStrategy: 'static',
        testGroup: 'static_annual_v1',
        originalPrice: 999,
        discountedPrice: 799,
      }
    };

    return offers[eventType];
  }

  /**
   * Log retention event to database
   */
  async logRetentionEvent(
    userId: string, 
    eventType: 'trial_declined' | 'trial_cancelled' | 'subscription_cancelled',
    action: 'triggered' | 'accepted' | 'declined' | 'ignored'
  ): Promise<void> {
    try {
      const offer = this.getStaticRetentionOffer(eventType);
      
      const retentionEvent: Partial<RetentionEvent> = {
        user_id: userId,
        event_type: eventType,
        triggered_at: new Date().toISOString(),
        modal_shown: action !== 'triggered',
        action_taken: action === 'triggered' ? undefined : action,
        discount_offered: offer.discount,
      };

      const { error } = await this.supabase
        .from('retention_events')
        .insert(retentionEvent);

      if (error) {
        console.error('[RetentionService] Error logging retention event:', error);
      } else {
        console.log(`[RetentionService] Logged retention event: ${eventType} - ${action}`);
      }
    } catch (error) {
      console.error('[RetentionService] Error in logRetentionEvent:', error);
    }
  }

  /**
   * Get recent retention events for user
   */
  async getRecentRetentionEvents(userId: string, days: number = 30): Promise<RetentionEvent[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('retention_events')
        .select('*')
        .eq('user_id', userId)
        .gte('triggered_at', startDate.toISOString())
        .order('triggered_at', { ascending: false });

      if (error) {
        console.error('[RetentionService] Error fetching retention events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[RetentionService] Error in getRecentRetentionEvents:', error);
      return [];
    }
  }

  /**
   * Calculate discount amount for pricing
   */
  calculateDiscountAmount(originalPrice: number, discountPercentage: number): number {
    return Math.round(originalPrice * (discountPercentage / 100));
  }

  /**
   * Apply discount to price
   */
  applyDiscount(originalPrice: number, discountPercentage: number): number {
    const discountAmount = this.calculateDiscountAmount(originalPrice, discountPercentage);
    return originalPrice - discountAmount;
  }

  /**
   * Generate discount code for user
   */
  generateDiscountCode(userId: string, eventType: string): string {
    const timestamp = Date.now().toString(36);
    const userHash = userId.slice(-6);
    const eventCode = eventType.substring(0, 3).toUpperCase();
    
    return `${eventCode}20-${userHash}-${timestamp}`.toUpperCase();
  }

  /**
   * Validate discount code
   */
  async validateDiscountCode(code: string, userId: string): Promise<boolean> {
    try {
      // Basic validation - in production, store codes in database
      const parts = code.split('-');
      if (parts.length !== 3) return false;
      
      const userHash = userId.slice(-6);
      return parts[1] === userHash;
    } catch (error) {
      console.error('[RetentionService] Error validating discount code:', error);
      return false;
    }
  }

  // =============================================
  // DYNAMIC PRICING HELPER METHODS
  // =============================================

  /**
   * Get user subscription data for scoring
   */
  private async getUserSubscriptionData(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      return data || {};
    } catch (error) {
      console.error('[RetentionService] Error fetching subscription data:', error);
      return {};
    }
  }

  /**
   * Get user usage data for scoring
   */
  private async getUserUsageData(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      return data || {};
    } catch (error) {
      console.error('[RetentionService] Error fetching usage data:', error);
      return {};
    }
  }

  /**
   * Get user profile data for scoring
   */
  private async getUserProfileData(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      return data || {};
    } catch (error) {
      console.error('[RetentionService] Error fetching profile data:', error);
      return {};
    }
  }

  /**
   * Calculate engagement score (0-30 points)
   */
  private calculateEngagementScore(usage: any, profile: any): number {
    let score = 0;
    
    // Daily usage patterns (0-15 points)
    const playbooksUsed = usage.playbooks_used || usage.playbooks_generated || 0;
    const devotionalsUsed = usage.devotionals_used || usage.devotionals_generated || 0;
    const journalEntries = usage.journal_entries || 0;
    
    score += Math.min(15, (playbooksUsed + devotionalsUsed + journalEntries) * 2);
    
    // Feature usage diversity (0-10 points)
    const featuresUsed = [
      playbooksUsed > 0,
      devotionalsUsed > 0,
      journalEntries > 0,
      usage.smart_journal_entries > 0,
      usage.export_count > 0
    ].filter(Boolean).length;
    
    score += featuresUsed * 2;
    
    // Consistency (0-5 points)
    const daysActive = profile.days_active || 1;
    const accountAge = this.calculateAccountAgeInDays(profile.created_at);
    const consistencyRatio = Math.min(1, daysActive / Math.max(1, accountAge));
    score += Math.round(consistencyRatio * 5);
    
    return Math.min(30, score);
  }

  /**
   * Calculate subscription history score (0-25 points)
   */
  private calculateSubscriptionHistoryScore(subscription: any): number {
    let score = 0;
    
    // Subscription duration (0-15 points)
    if (subscription.created_at) {
      const subscriptionDays = this.calculateAccountAgeInDays(subscription.created_at);
      score += Math.min(15, Math.floor(subscriptionDays / 7)); // 1 point per week
    }
    
    // Tier level (0-10 points)
    const tierScores = {
      'basic': 2,
      'starter': 4,
      'growth': 6,
      'transformation': 8,
      'family': 10
    };
    score += tierScores[subscription.tier] || 0;
    
    return Math.min(25, score);
  }

  /**
   * Calculate content creation score (0-20 points)
   */
  private calculateContentCreationScore(usage: any): number {
    let score = 0;
    
    // Playbooks created (0-10 points)
    const playbooks = usage.playbooks_used || usage.playbooks_generated || 0;
    score += Math.min(10, playbooks);
    
    // Devotionals created (0-5 points)
    const devotionals = usage.devotionals_used || usage.devotionals_generated || 0;
    score += Math.min(5, devotionals);
    
    // Journal entries (0-5 points)
    const journalEntries = usage.journal_entries || 0;
    score += Math.min(5, Math.floor(journalEntries / 5));
    
    return Math.min(20, score);
  }

  /**
   * Calculate social value score (0-15 points)
   */
  private calculateSocialValueScore(subscription: any, profile: any): number {
    let score = 0;
    
    // Family plan owner (0-10 points)
    if (subscription.tier === 'family' && subscription.family_owner_id === subscription.user_id) {
      score += 10;
      
      // Additional points for family members
      const familyMembers = subscription.family_members?.length || 0;
      score += Math.min(5, familyMembers);
    }
    
    // Referrals (0-5 points) - placeholder for future implementation
    const referrals = profile.referrals_made || 0;
    score += Math.min(5, referrals);
    
    return Math.min(15, score);
  }

  /**
   * Calculate spiritual growth score (0-10 points)
   */
  private calculateSpiritualGrowthScore(profile: any): number {
    let score = 0;
    
    // Goal completion (0-5 points)
    const goalsCompleted = profile.goals_completed || 0;
    score += Math.min(5, goalsCompleted);
    
    // Streak consistency (0-3 points)
    const currentStreak = profile.current_streak || 0;
    score += Math.min(3, Math.floor(currentStreak / 7)); // 1 point per week streak
    
    // Onboarding completion (0-2 points)
    if (profile.onboarding_completed) {
      score += 2;
    }
    
    return Math.min(10, score);
  }

  /**
   * Generate personalized message based on user data
   */
  private generatePersonalizedMessage(
    eventType: string,
    discount: number,
    userValueScore: UserValueScore,
    daysSinceEvent: number
  ): { title: string; message: string; cta: string } {
    const isHighValue = userValueScore.totalScore >= 80;
    const isLongTerm = daysSinceEvent >= 30;
    
    if (isHighValue) {
      // High-value users get relationship-focused messaging
      return {
        title: "We value your spiritual journey",
        message: `As a dedicated member of our community, we'd love to welcome you back with ${discount}% off`,
        cta: `Continue My Journey (${discount}% Off)`
      };
    } else if (isLongTerm) {
      // Long-term win-back campaigns
      return {
        title: "Your faith journey is waiting",
        message: `It's been a while! Restart your spiritual growth with ${discount}% off`,
        cta: `Restart My Journey (${discount}% Off)`
      };
    } else {
      // Standard messaging
      return {
        title: "Don't let your spiritual growth pause",
        message: `Continue your faith journey with ${discount}% off your subscription`,
        cta: `Get ${discount}% Off Now`
      };
    }
  }

  /**
   * Calculate account age in days
   */
  private calculateAccountAgeInDays(createdAt: string): number {
    if (!createdAt) return 0;
    
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const retentionService = new RetentionService();
