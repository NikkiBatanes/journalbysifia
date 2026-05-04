import { NotificationPreferences } from '../notificationManagementService';

export const SMART_NOTIFICATION_ENGINE_VERSION = 'state_v1';

export const SMART_NOTIFICATION_TYPES = [
  'devotional_day_ready',
  'devotional_prayer_prompt',
  'devotional_reflection_prompt',
  'devotional_verse_revisit',
  'devotional_completed_reflection',
  'playbook_word_to_speak',
  'playbook_faithful_action',
  'playbook_verse_revisit',
  'playbook_verse_reflection',
  'playbook_prayer_revisit',
  'playbook_to_devotional',
  'playbook_actions_complete',
  'playbook_actions_milestone',
  'journal_todays_focus',
  'journal_todo',
  'journal_gratitude',
  'journal_todays_win',
  'journal_looking_forward',
  'heart_journal_prompt',
  'prayer_request_care',
  'prayer_answered_check',
  'prayer_today',
  'prayer_people_nudge',
  'create_devotional',
  'create_playbook',
  'create_first_devotional',
  'usage_room_devotional',
  'usage_room_playbook',
  'content_refresh_wait',
  'upgrade_room',
] as const;

export type SmartNotificationType = typeof SMART_NOTIFICATION_TYPES[number];

export type SmartNotificationCategory =
  | 'devotional'
  | 'playbook'
  | 'journal'
  | 'prayer'
  | 'creation'
  | 'subscription'
  | 'recovery';

export type SmartNotificationTimeWindow =
  | 'early_morning'
  | 'devotional_morning'
  | 'mid_morning'
  | 'late_morning'
  | 'pre_midday'
  | 'midday'
  | 'early_afternoon'
  | 'afternoon'
  | 'late_afternoon'
  | 'early_evening'
  | 'evening'
  | 'late_evening'
  | 'night';

export type SmartNotificationPrivacyLevel = 'public' | 'personal' | 'sensitive';

export type SmartNotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface SmartNotificationCopy {
  title: string;
  message: string;
}

export interface SmartNotificationSource {
  sourceType:
    | 'devotional'
    | 'devotional_day'
    | 'playbook'
    | 'action_step'
    | 'journal'
    | 'prayer'
    | 'subscription'
    | 'fallback';
  sourceId?: string;
  sourceSubId?: string;
}

export interface SmartNotificationCandidate {
  type: SmartNotificationType;
  category: SmartNotificationCategory;
  timeWindow: SmartNotificationTimeWindow;
  priority: SmartNotificationPriority;
  score: number;
  dedupeKey: string;
  copy: SmartNotificationCopy;
  deepLink: string;
  privacyLevel: SmartNotificationPrivacyLevel;
  source: SmartNotificationSource;
  metadata?: Record<string, unknown>;
}

export interface ScheduledSmartNotification extends SmartNotificationCandidate {
  scheduledFor: Date;
}

export interface SmartNotificationDecision {
  candidates: SmartNotificationCandidate[];
  selected: ScheduledSmartNotification[];
  cancelledStaleIds: string[];
  skippedDedupeKeys: string[];
}

export const SMART_NOTIFICATION_PREFERENCE_MAP: Record<SmartNotificationType, keyof NotificationPreferences> = {
  devotional_day_ready: 'devotional_reminders',
  devotional_prayer_prompt: 'devotional_reminders',
  devotional_reflection_prompt: 'devotional_reminders',
  devotional_verse_revisit: 'devotional_reminders',
  devotional_completed_reflection: 'devotional_reminders',
  playbook_word_to_speak: 'playbook_steps',
  playbook_faithful_action: 'playbook_steps',
  playbook_verse_revisit: 'playbook_steps',
  playbook_verse_reflection: 'playbook_steps',
  playbook_prayer_revisit: 'playbook_steps',
  playbook_to_devotional: 'devotional_reminders',
  playbook_actions_complete: 'playbook_steps',
  playbook_actions_milestone: 'playbook_steps',
  journal_todays_focus: 'journal_prompts',
  journal_todo: 'journal_prompts',
  journal_gratitude: 'journal_prompts',
  journal_todays_win: 'journal_prompts',
  journal_looking_forward: 'journal_prompts',
  heart_journal_prompt: 'journal_prompts',
  prayer_request_care: 'prayer_request_alerts',
  prayer_answered_check: 'prayer_reminders',
  prayer_today: 'prayer_reminders',
  prayer_people_nudge: 'prayer_reminders',
  create_devotional: 'devotional_reminders',
  create_playbook: 'playbook_steps',
  create_first_devotional: 'devotional_reminders',
  usage_room_devotional: 'devotional_reminders',
  usage_room_playbook: 'playbook_steps',
  content_refresh_wait: 'trial_notifications',
  upgrade_room: 'trial_notifications',
};

export const SMART_NOTIFICATION_IMPORTANT_TYPES: SmartNotificationType[] = [
  'devotional_day_ready',
  'devotional_prayer_prompt',
  'devotional_reflection_prompt',
  'playbook_faithful_action',
  'playbook_word_to_speak',
  'playbook_verse_reflection',
  'prayer_request_care',
  'journal_looking_forward',
];
