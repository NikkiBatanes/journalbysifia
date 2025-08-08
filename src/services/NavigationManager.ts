/**
 * NavigationManager.ts
 * Advanced navigation system with deep linking and analytics
 */

import { NavigationContainerRef, CommonActions } from '@react-navigation/native';
import { supabase } from './supabaseClient';

export type DashboardNavigationTarget =
  | 'playbook_detail'
  | 'devotional_detail'
  | 'journal_entry'
  | 'prayer_log'
  | 'streak_detail'
  | 'analytics'
  | 'ai_insights'
  | 'verse_detail'
  | 'affirmation_detail'
  | 'action_steps'
  | 'reflection_questions'
  | 'community'
  | 'profile'
  | 'settings';

interface NavigationParams {
  [key: string]: any;
}

interface NavigationEvent {
  target: DashboardNavigationTarget;
  params?: NavigationParams;
  timestamp: Date;
  userId?: string;
  source: 'dashboard' | 'deep_link' | 'notification' | 'manual';
}

class NavigationManager {
  private navigationRef: NavigationContainerRef<any> | null = null;
  private navigationHistory: NavigationEvent[] = [];
  private userId: string | null = null;

  setNavigationRef(ref: NavigationContainerRef<any>) {
    this.navigationRef = ref;
  }

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  /**
   * Navigate to a specific dashboard target with analytics tracking
   */
  async navigateTo(
    target: DashboardNavigationTarget,
    params: NavigationParams = {},
    source: NavigationEvent['source'] = 'manual'
  ) {
    if (!this.navigationRef) {
      console.warn('Navigation ref not set');
      return;
    }

    // Track navigation event
    const event: NavigationEvent = {
      target,
      params,
      timestamp: new Date(),
      userId: this.userId,
      source,
    };

    this.navigationHistory.push(event);
    await this.logNavigationEvent(event);

    // Execute navigation based on target
    switch (target) {
      case 'playbook_detail':
        this.navigationRef.navigate('PlaybookDetail', params);
        break;

      case 'devotional_detail':
        this.navigationRef.navigate('DevotionalDetail', params);
        break;

      case 'journal_entry':
        this.navigationRef.navigate('Journal', {
          action: 'new_entry',
          ...params,
        });
        break;

      case 'prayer_log':
        this.navigationRef.navigate('Prayer', {
          action: 'new_prayer',
          ...params,
        });
        break;

      case 'streak_detail':
        this.navigationRef.navigate('Analytics', {
          tab: 'streaks',
          streakType: params.streakType,
        });
        break;

      case 'analytics':
        this.navigationRef.navigate('Analytics', params);
        break;

      case 'ai_insights':
        this.navigationRef.navigate('AIInsights', params);
        break;

      case 'verse_detail':
        this.navigationRef.navigate('VerseDetail', params);
        break;

      case 'affirmation_detail':
        this.navigationRef.navigate('AffirmationDetail', params);
        break;

      case 'action_steps':
        this.navigationRef.navigate('ActionSteps', params);
        break;

      case 'reflection_questions':
        this.navigationRef.navigate('Reflection', params);
        break;

      case 'community':
        this.navigationRef.navigate('Community', params);
        break;

      case 'profile':
        this.navigationRef.navigate('Profile', params);
        break;

      case 'settings':
        this.navigationRef.navigate('Settings', params);
        break;

      default:
        console.warn(`Unknown navigation target: ${target}`);
    }
  }

  /**
   * Handle deep links from notifications or external sources
   */
  async handleDeepLink(url: string) {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      const params = Object.fromEntries(parsedUrl.searchParams);

      let target: DashboardNavigationTarget | null = null;

      // Parse deep link paths
      if (path.startsWith('/playbook/')) {
        target = 'playbook_detail';
        params.playbookId = path.split('/')[2];
      } else if (path.startsWith('/devotional/')) {
        target = 'devotional_detail';
        params.devotionalId = path.split('/')[2];
      } else if (path === '/journal/new') {
        target = 'journal_entry';
      } else if (path === '/prayer/new') {
        target = 'prayer_log';
      } else if (path === '/analytics') {
        target = 'analytics';
      } else if (path === '/insights') {
        target = 'ai_insights';
      }

      if (target) {
        await this.navigateTo(target, params, 'deep_link');
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  }

  /**
   * Navigate back with analytics
   */
  goBack() {
    if (!this.navigationRef) {return;}

    this.navigationRef.goBack();

    // Log back navigation
    this.logNavigationEvent({
      target: 'playbook_detail', // placeholder
      timestamp: new Date(),
      userId: this.userId,
      source: 'manual',
    });
  }

  /**
   * Get navigation suggestions based on user behavior
   */
  getNavigationSuggestions(): DashboardNavigationTarget[] {
    const recentTargets = this.navigationHistory
      .slice(-10)
      .map(event => event.target);

    const targetCounts = recentTargets.reduce((acc, target) => {
      acc[target] = (acc[target] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Return most visited targets
    return Object.entries(targetCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([target]) => target as DashboardNavigationTarget);
  }

  /**
   * Log navigation event to analytics
   */
  private async logNavigationEvent(event: NavigationEvent) {
    try {
      if (!this.userId) {return;}

      await supabase
        .from('faith_points_log')
        .insert({
          user_id: this.userId,
          activity_type: 'navigation',
          content_type: 'dashboard_navigation',
          content_id: event.target,
          metadata: {
            params: event.params,
            source: event.source,
            timestamp: event.timestamp.toISOString(),
          },
        });
    } catch (error) {
      console.error('Error logging navigation event:', error);
    }
  }

  /**
   * Get navigation analytics
   */
  getNavigationAnalytics() {
    const totalNavigations = this.navigationHistory.length;
    const uniqueTargets = new Set(this.navigationHistory.map(e => e.target)).size;
    const mostVisited = this.getNavigationSuggestions()[0];

    return {
      totalNavigations,
      uniqueTargets,
      mostVisited,
      recentHistory: this.navigationHistory.slice(-5),
    };
  }

  /**
   * Clear navigation history (for privacy)
   */
  clearHistory() {
    this.navigationHistory = [];
  }
}

// Singleton instance
export const navigationManager = new NavigationManager();

// Helper functions for dashboard components
export const dashboardNavigation = {
  toPlaybook: (playbookId: string) =>
    navigationManager.navigateTo('playbook_detail', { playbookId }, 'dashboard'),

  toDevotional: (devotionalId: string) =>
    navigationManager.navigateTo('devotional_detail', { devotionalId }, 'dashboard'),

  toJournal: () =>
    navigationManager.navigateTo('journal_entry', {}, 'dashboard'),

  toPrayer: () =>
    navigationManager.navigateTo('prayer_log', {}, 'dashboard'),

  toStreakDetail: (streakType: string) =>
    navigationManager.navigateTo('streak_detail', { streakType }, 'dashboard'),

  toAnalytics: () =>
    navigationManager.navigateTo('analytics', {}, 'dashboard'),

  toAIInsights: () =>
    navigationManager.navigateTo('ai_insights', {}, 'dashboard'),

  toVerseDetail: (verse: any) =>
    navigationManager.navigateTo('verse_detail', { verse }, 'dashboard'),

  toAffirmationDetail: (affirmation: any) =>
    navigationManager.navigateTo('affirmation_detail', { affirmation }, 'dashboard'),

  toActionSteps: () =>
    navigationManager.navigateTo('action_steps', {}, 'dashboard'),

  toReflectionQuestions: () =>
    navigationManager.navigateTo('reflection_questions', {}, 'dashboard'),

  toCommunity: () =>
    navigationManager.navigateTo('community', {}, 'dashboard'),

  toProfile: () =>
    navigationManager.navigateTo('profile', {}, 'dashboard'),

  toSettings: () =>
    navigationManager.navigateTo('settings', {}, 'dashboard'),
};

export default NavigationManager;
