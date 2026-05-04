import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';
import { Logger } from '../utils/ProductionLogger';

/**
 * Review Prompt Service
 *
 * Industry-standard automatic review prompting that triggers at positive
 * user experience moments while respecting user preferences and platform guidelines.
 *
 * Key principles:
 * - Only prompt after positive user experiences (achievements, completions)
 * - Respect gating (30 days between prompts, max 3 per year)
 * - Never interrupt onboarding or critical flows
 * - Allow graceful fallback to store page
 * - Track prompts to avoid spamming
 */

const LAST_PROMPT_KEY = 'review:lastPromptAt';
const COUNT_KEY_PREFIX = 'review:promptCount:';
const MIN_DAYS_BETWEEN = 30; // days
const MAX_PER_YEAR = 3;

interface ReviewPromptOptions {
  /**
   * Optional context for logging/analytics
   */
  triggerSource?: string;
  /**
   * Whether to force the prompt (bypass gating for testing)
   */
  force?: boolean;
}

/**
 * Check if a review prompt should be shown based on gating rules
 */
async function canPromptReview(): Promise<boolean> {
  try {
    const now = Date.now();
    const year = new Date().getFullYear();
    const countKey = `${COUNT_KEY_PREFIX}${year}`;

    const lastPromptRaw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    const countRaw = await AsyncStorage.getItem(countKey);

    const lastPromptAt = lastPromptRaw ? parseInt(lastPromptRaw, 10) : 0;
    const promptCount = countRaw ? parseInt(countRaw, 10) : 0;

    const daysSince = lastPromptAt ? (now - lastPromptAt) / (1000 * 60 * 60 * 24) : Infinity;
    const withinLimit = promptCount < MAX_PER_YEAR;
    const spacedEnough = daysSince >= MIN_DAYS_BETWEEN;

    const canPrompt = withinLimit && spacedEnough;

    Logger.info('[ReviewPromptService] Gating check', {
      canPrompt,
      daysSince: Math.round(daysSince),
      promptCount,
      maxPerYear: MAX_PER_YEAR,
      minDaysBetween: MIN_DAYS_BETWEEN,
    });

    return canPrompt;
  } catch (error) {
    Logger.error('[ReviewPromptService] Error checking gating rules', error as Error);
    return false; // Fail safe: don't prompt if we can't check
  }
}

/**
 * Record that a review prompt was shown
 */
async function recordPrompt(): Promise<void> {
  try {
    const now = Date.now();
    const year = new Date().getFullYear();
    const countKey = `${COUNT_KEY_PREFIX}${year}`;

    const countRaw = await AsyncStorage.getItem(countKey);
    const promptCount = countRaw ? parseInt(countRaw, 10) : 0;

    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(now));
    await AsyncStorage.setItem(countKey, String(promptCount + 1));

    Logger.info('[ReviewPromptService] Recorded review prompt', {
      timestamp: new Date(now).toISOString(),
      promptCount: promptCount + 1,
      year,
    });
  } catch (error) {
    Logger.error('[ReviewPromptService] Error recording prompt', error as Error);
  }
}

/**
 * Open the store review page directly (fallback if in-app review unavailable)
 */
async function openStoreReview(): Promise<void> {
  try {
    const APPLE_APP_ID = '6751785713';
    const ANDROID_PACKAGE = 'com.sifiaopc.app';

    const { Linking, Platform } = await import('react-native');

    if (Platform.OS === 'ios') {
      if (!APPLE_APP_ID) {
        Logger.warn('[ReviewPromptService] No Apple App ID configured');
        return;
      }
      const iosDeepLink = `itms-apps://itunes.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
      const iosWeb = `https://apps.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
      const supported = await Linking.canOpenURL(iosDeepLink);
      await Linking.openURL(supported ? iosDeepLink : iosWeb);
    } else {
      const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
      const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
      const supported = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(supported ? marketUrl : webUrl);
    }

    Logger.info('[ReviewPromptService] Opened store review page');
  } catch (error) {
    Logger.error('[ReviewPromptService] Error opening store review', error as Error);
  }
}

/**
 * Request an in-app review with proper gating and fallback
 *
 * This is the main entry point for automatic review prompting.
 * Call this at positive user experience moments:
 * - After completing a playbook
 * - After reaching faith points milestones
 * - After leveling up
 * - After completing a devotional
 * - After marking a prayer as answered
 *
 * @param options - Optional configuration
 * @returns Promise<boolean> - true if prompt was shown, false if skipped
 */
export async function requestReview(options?: ReviewPromptOptions): Promise<boolean> {
  const { triggerSource, force } = options || {};

  try {
    Logger.info('[ReviewPromptService] Review requested', { triggerSource });

    // Check gating rules (unless forced)
    const canPrompt = force || await canPromptReview();

    if (!canPrompt) {
      Logger.info('[ReviewPromptService] Review prompt skipped (gating)');
      return false;
    }

    // Check if in-app review is available
    if (InAppReview.isAvailable()) {
      Logger.info('[ReviewPromptService] Requesting in-app review');
      await InAppReview.RequestInAppReview();

      // Record the attempt regardless of whether dialog actually appears
      // (platform may suppress it based on their own rules)
      await recordPrompt();

      Logger.info('[ReviewPromptService] In-app review requested');
      return true;
    }

    // Fallback to store page
    Logger.info('[ReviewPromptService] In-app review unavailable, using store fallback');
    await openStoreReview();
    await recordPrompt();

    return true;
  } catch (error) {
    Logger.error('[ReviewPromptService] Error requesting review', error as Error);

    // Try fallback on error
    try {
      await openStoreReview();
      await recordPrompt();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Reset review prompt tracking (for testing purposes)
 * WARNING: Only use this in development/testing
 */
export async function resetReviewTracking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_PROMPT_KEY);
    const year = new Date().getFullYear();
    await AsyncStorage.removeItem(`${COUNT_KEY_PREFIX}${year}`);
    Logger.warn('[ReviewPromptService] Review tracking reset (testing only)');
  } catch (error) {
    Logger.error('[ReviewPromptService] Error resetting tracking', error as Error);
  }
}

/**
 * Get current review prompt statistics (for debugging)
 */
export async function getReviewStats(): Promise<{
  lastPromptAt: number | null;
  daysSinceLastPrompt: number | null;
  promptCountThisYear: number;
  canPrompt: boolean;
}> {
  try {
    const now = Date.now();
    const year = new Date().getFullYear();
    const countKey = `${COUNT_KEY_PREFIX}${year}`;

    const lastPromptRaw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    const countRaw = await AsyncStorage.getItem(countKey);

    const lastPromptAt = lastPromptRaw ? parseInt(lastPromptRaw, 10) : null;
    const promptCount = countRaw ? parseInt(countRaw, 10) : 0;
    const daysSince = lastPromptAt ? (now - lastPromptAt) / (1000 * 60 * 60 * 24) : null;

    const canPrompt = promptCount < MAX_PER_YEAR && (daysSince === null || daysSince >= MIN_DAYS_BETWEEN);

    return {
      lastPromptAt,
      daysSinceLastPrompt: daysSince !== null ? Math.round(daysSince) : null,
      promptCountThisYear: promptCount,
      canPrompt,
    };
  } catch (error) {
    Logger.error('[ReviewPromptService] Error getting stats', error as Error);
    return {
      lastPromptAt: null,
      daysSinceLastPrompt: null,
      promptCountThisYear: 0,
      canPrompt: false,
    };
  }
}
