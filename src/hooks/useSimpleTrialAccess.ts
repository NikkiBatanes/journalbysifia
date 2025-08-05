// =====================================================
// SIMPLIFIED TRIAL ACCESS HOOK
// =====================================================
// This is a simplified version that works with your existing codebase
// without complex type dependencies

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export interface SimpleTrialStatus {
  isActive: boolean;
  daysRemaining: number;
  hasExpired: boolean;
  isLoading: boolean;
}

export interface SimpleFeatureAccess {
  smartJournalingEnabled: boolean;
  hasAllTemplates: boolean;
  playbooksRemaining: number;
  devotionalsRemaining: number;
  isUnlimited: boolean;
}

export const useSimpleTrialAccess = (userId?: string) => {
  const [trialStatus, setTrialStatus] = useState<SimpleTrialStatus>({
    isActive: false,
    daysRemaining: 0,
    hasExpired: true,
    isLoading: true,
  });

  const [featureAccess, setFeatureAccess] = useState<SimpleFeatureAccess>({
    smartJournalingEnabled: false,
    hasAllTemplates: false,
    playbooksRemaining: 0,
    devotionalsRemaining: 0,
    isUnlimited: false,
  });

  const fetchTrialStatus = async () => {
    if (!userId) {
      setTrialStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, trial_ends_at, status')
        .eq('user_id', userId)
        .single();

      if (!subscription) {
        setTrialStatus({
          isActive: false,
          daysRemaining: 0,
          hasExpired: true,
          isLoading: false,
        });
        return;
      }

      const now = new Date();
      const trialEndsAt = subscription.trial_ends_at 
        ? new Date(subscription.trial_ends_at)
        : new Date();

      const hasExpired = now > trialEndsAt;
      const isActive = subscription.tier === 'free_trial' && !hasExpired;
      const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      setTrialStatus({
        isActive,
        daysRemaining,
        hasExpired,
        isLoading: false,
      });

      // Set feature access based on trial status
      const isUnlimited = isActive; // During trial, everything is unlimited
      const isPaidTier = subscription.tier !== 'free_trial';

      setFeatureAccess({
        smartJournalingEnabled: isActive || isPaidTier,
        hasAllTemplates: isActive || isPaidTier,
        playbooksRemaining: isUnlimited ? 999 : (isPaidTier ? getPlaybookLimit(subscription.tier) : 0),
        devotionalsRemaining: isUnlimited ? 999 : (isPaidTier ? getDevotionalLimit(subscription.tier) : 0),
        isUnlimited,
      });

    } catch (error) {
      console.error('Error fetching trial status:', error);
      setTrialStatus({
        isActive: false,
        daysRemaining: 0,
        hasExpired: true,
        isLoading: false,
      });
    }
  };

  useEffect(() => {
    fetchTrialStatus();
  }, [userId]);

  const startTrial = async () => {
    if (!userId) return;

    try {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 3);

      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          tier: 'free_trial',
          status: 'active',
          trial_ends_at: trialEndsAt.toISOString(),
          trial_started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      // Refresh status
      fetchTrialStatus();
    } catch (error) {
      console.error('Error starting trial:', error);
    }
  };

  const checkCanGenerate = async (contentType: 'playbook' | 'devotional') => {
    const remaining = contentType === 'playbook' 
      ? featureAccess.playbooksRemaining 
      : featureAccess.devotionalsRemaining;

    if (remaining > 0) {
      return { canGenerate: true, remainingCount: remaining };
    }

    if (trialStatus.hasExpired && !trialStatus.isActive) {
      return { canGenerate: false, reason: 'trial_expired', remainingCount: 0 };
    }

    return { canGenerate: false, reason: 'limit_reached', remainingCount: 0 };
  };

  return {
    // Trial status
    trialStatus,
    
    // Feature access
    featureAccess,
    
    // Actions
    startTrial,
    checkCanGenerate,
    refreshStatus: fetchTrialStatus,
    
    // Computed values
    hasActiveAccess: trialStatus.isActive,
    daysRemaining: trialStatus.daysRemaining,
    hasExpired: trialStatus.hasExpired,
    isLoading: trialStatus.isLoading,
  };
};

// Helper functions for tier limits
const getPlaybookLimit = (tier: string): number => {
  switch (tier) {
    case 'starter': return 4;
    case 'growth': return 15;
    case 'transformation': return 999;
    case 'family': return 999;
    default: return 0;
  }
};

const getDevotionalLimit = (tier: string): number => {
  switch (tier) {
    case 'starter': return 4;
    case 'growth': return 15;
    case 'transformation': return 999;
    case 'family': return 999;
    default: return 0;
  }
};

// Hook for specific feature access
export const useFeatureAccess = (userId?: string, feature: keyof SimpleFeatureAccess) => {
  const { featureAccess, isLoading } = useSimpleTrialAccess(userId);
  
  return {
    hasAccess: featureAccess[feature] || false,
    isLoading,
  };
};

// Hook for upgrade prompts
export const useUpgradePrompts = () => {
  const getUpgradePrompt = (feature: string) => {
    const prompts: Record<string, any> = {
      smartJournaling: {
        title: 'Unlock Smart Journaling',
        message: 'Get AI-powered insights and personalized prompts to deepen your spiritual journey.',
        recommendedTier: 'starter'
      },
      journalTemplates: {
        title: 'Access All Journal Templates',
        message: 'Explore 20+ guided templates for prayer, gratitude, Bible study, and spiritual growth.',
        recommendedTier: 'starter'
      },
      playbooks: {
        title: 'Generate More Playbooks',
        message: 'Create unlimited personalized spiritual growth plans tailored to your journey.',
        recommendedTier: 'growth'
      },
      devotionals: {
        title: 'Unlimited Devotionals',
        message: 'Access daily AI-generated devotionals personalized to your spiritual needs.',
        recommendedTier: 'growth'
      },
    };

    return prompts[feature] || {
      title: 'Upgrade Your Plan',
      message: 'Unlock premium features to enhance your spiritual growth journey.',
      recommendedTier: 'starter'
    };
  };

  return { getUpgradePrompt };
};
