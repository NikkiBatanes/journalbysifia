/**
 * Trial Configuration Constants
 * 
 * Centralized configuration for trial periods and related settings.
 * Update these values to change trial duration across the entire app.
 */

export const TRIAL_CONFIG = {
  // Trial duration in days
  TRIAL_DURATION_DAYS: 3,
  
  // Trial duration in milliseconds (for calculations)
  TRIAL_DURATION_MS: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
  
  // Trial duration in seconds (for some APIs)
  TRIAL_DURATION_SECONDS: 3 * 24 * 60 * 60, // 3 days in seconds
  
  // PostgreSQL interval string
  TRIAL_DURATION_INTERVAL: '3 days',
  
  // Display strings
  TRIAL_DURATION_DISPLAY: '3 days',
  TRIAL_DURATION_DISPLAY_SHORT: '3d',
  
  // Trial tier identifier
  TRIAL_TIER: 'free_trial' as const,
  
  // Trial welcome messages
  TRIAL_WELCOME_TITLE: '🎉 Welcome to your 3-day trial!',
  TRIAL_WELCOME_SUBTITLE: 'Experience the full power of siFia for 3 days',
  TRIAL_WELCOME_DESCRIPTION: 'You have 3 days of full access to explore all features.',
  
  // Trial expiration messages
  TRIAL_EXPIRED_TITLE: 'Your 3-day trial has ended',
  TRIAL_EXPIRED_SUBTITLE: 'Upgrade to continue enjoying premium features',
  
  // Trial countdown messages
  TRIAL_COUNTDOWN_SINGULAR: 'day remaining',
  TRIAL_COUNTDOWN_PLURAL: 'days remaining',
} as const;

/**
 * Calculate trial end date from start date
 */
export function calculateTrialEndDate(startDate: Date = new Date()): Date {
  return new Date(startDate.getTime() + TRIAL_CONFIG.TRIAL_DURATION_MS);
}

/**
 * Calculate trial end date as ISO string
 */
export function calculateTrialEndDateISO(startDate: Date = new Date()): string {
  return calculateTrialEndDate(startDate).toISOString();
}

/**
 * Check if trial is still active
 */
export function isTrialActive(trialEndDate: string | Date): boolean {
  const endDate = typeof trialEndDate === 'string' ? new Date(trialEndDate) : trialEndDate;
  return endDate.getTime() > Date.now();
}

/**
 * Get days remaining in trial
 */
export function getDaysRemainingInTrial(trialEndDate: string | Date): number {
  const endDate = typeof trialEndDate === 'string' ? new Date(trialEndDate) : trialEndDate;
  const msRemaining = endDate.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return Math.max(0, daysRemaining);
}

/**
 * Get trial countdown message
 */
export function getTrialCountdownMessage(trialEndDate: string | Date): string {
  const daysRemaining = getDaysRemainingInTrial(trialEndDate);
  
  if (daysRemaining <= 0) {
    return TRIAL_CONFIG.TRIAL_EXPIRED_TITLE;
  }
  
  if (daysRemaining === 1) {
    return `${daysRemaining} ${TRIAL_CONFIG.TRIAL_COUNTDOWN_SINGULAR}`;
  }
  
  return `${daysRemaining} ${TRIAL_CONFIG.TRIAL_COUNTDOWN_PLURAL}`;
}

/**
 * SQL helper for trial duration
 */
export const TRIAL_SQL = {
  // For PostgreSQL INTERVAL
  DURATION_INTERVAL: `INTERVAL '${TRIAL_CONFIG.TRIAL_DURATION_INTERVAL}'`,
  
  // For calculating trial end date in SQL
  END_DATE_CALCULATION: `NOW() + INTERVAL '${TRIAL_CONFIG.TRIAL_DURATION_INTERVAL}'`,
  
  // For checking if trial is active
  IS_ACTIVE_CHECK: `trial_ends_at > NOW()`,
  
  // For checking if trial has expired
  IS_EXPIRED_CHECK: `trial_ends_at <= NOW()`,
} as const;

export default TRIAL_CONFIG;
