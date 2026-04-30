import { SmartNotificationCopy, SmartNotificationType } from './notificationTypes';

interface CopyContext {
  dayNumber?: number;
  totalDays?: number;
  title?: string;
  actionText?: string;
  verseReference?: string;
  verseText?: string;
  questionText?: string;
  wordToSpeak?: string;
  heartJournalTitle?: string;
  personName?: string;
  remainingCount?: number;
  refreshDate?: string;
}

const compact = (value: string, maxLength = 92): string => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 1).trim()}...`;
};

const plural = (count: number, singular: string, pluralValue = `${singular}s`): string => {
  return count === 1 ? singular : pluralValue;
};

export function buildSmartNotificationCopy(
  type: SmartNotificationType,
  context: CopyContext = {}
): SmartNotificationCopy {
  switch (type) {
    case 'devotional_day_ready': {
      const day = context.dayNumber ? `Day ${context.dayNumber}` : 'Your next day';
      return {
        title: 'Your devotional is ready',
        message: compact(`${day} is ready when you are.`),
      };
    }

    case 'devotional_prayer_prompt':
      return {
        title: 'Pray today\'s devotional',
        message: compact('There is a prayer waiting inside today\'s devotional.'),
      };

    case 'devotional_reflection_prompt':
      return {
        title: 'Pause with this question',
        message: compact(context.questionText || 'One question from your devotional is ready for your journal.'),
      };

    case 'devotional_verse_revisit':
      return {
        title: 'Carry this verse today',
        message: compact(context.verseText || 'A verse from your devotional is worth revisiting today.'),
      };

    case 'devotional_completed_reflection':
      return {
        title: 'What is staying with you?',
        message: compact('You finished this devotional. What is staying with you today?'),
      };

    case 'playbook_word_to_speak':
      return {
        title: 'Speak this over today',
        message: compact(context.wordToSpeak || 'One word from your playbook is ready to speak over yourself.'),
      };

    case 'playbook_faithful_action':
      return {
        title: 'Take one faithful step',
        message: compact(context.actionText || 'One action from your playbook is ready for today.'),
      };

    case 'playbook_verse_revisit':
      return {
        title: 'Return to the verse',
        message: compact(context.verseText || 'The verse from your playbook is worth carrying today.'),
      };

    case 'playbook_prayer_revisit':
      return {
        title: 'Pray through your playbook',
        message: compact('Pray the prayer from your playbook walkthrough.'),
      };

    case 'playbook_to_devotional':
      return {
        title: 'Turn this into a devotional',
        message: compact('Your playbook can become a devotional for the season you are walking through.'),
      };

    case 'journal_todays_focus':
      return {
        title: 'Name today\'s focus',
        message: compact('What needs your focus before the day gets crowded?'),
      };

    case 'journal_todo':
      return {
        title: 'Choose your next step',
        message: compact('One to-do can become today\'s faithful step.'),
      };

    case 'journal_gratitude':
      return {
        title: 'Notice one gift',
        message: compact('Write one thing you are grateful for today.'),
      };

    case 'journal_todays_win':
      return {
        title: 'Name today\'s win',
        message: compact('Before the day closes, name where you saw grace.'),
      };

    case 'journal_looking_forward':
      return {
        title: 'Look toward tomorrow',
        message: compact('What are you looking forward to tomorrow?'),
      };

    case 'heart_journal_prompt':
      return {
        title: compact(context.heartJournalTitle || 'Check in with your heart', 58),
        message: compact('Take a quiet moment to answer it.'),
      };

    case 'prayer_request_care':
      return {
        title: compact(context.personName ? `Lift ${context.personName} today` : 'Lift someone up today', 58),
        message: compact('Take a quiet moment to pray for them.'),
      };

    case 'prayer_today':
      return {
        title: 'Begin with prayer',
        message: compact('Bring today before God for a quiet minute.'),
      };

    case 'create_first_devotional':
      return {
        title: 'Start your first devotional',
        message: compact('Start a devotional for the season you are walking through.'),
      };

    case 'create_devotional':
      return {
        title: 'Start a new devotional',
        message: compact('Start a devotional for the season you are walking through.'),
      };

    case 'create_playbook':
      return {
        title: 'Start a new playbook',
        message: compact('Are you going through something today? Start a new playbook.'),
      };

    case 'usage_room_devotional': {
      const count = context.remainingCount ?? 1;
      return {
        title: 'There is room for more',
        message: compact(`You still have room for ${count} more ${plural(count, 'devotional')} this month.`),
      };
    }

    case 'usage_room_playbook': {
      const count = context.remainingCount ?? 1;
      return {
        title: 'There is room for more',
        message: compact(`You still have room for ${count} more ${plural(count, 'playbook')} this month.`),
      };
    }

    case 'content_refresh_wait':
      return {
        title: 'Keep today simple',
        message: compact(context.refreshDate
          ? `New creation room returns on ${context.refreshDate}. Pray or revisit today's focus.`
          : 'Pray, journal, or revisit a verse while you wait for more creation room.'),
      };

    case 'upgrade_room':
      return {
        title: 'Need more room?',
        message: compact('Upgrade when you want more space to create and keep going.'),
      };

    case 'recovery_prayer':
      return {
        title: 'Begin again with prayer',
        message: compact('You do not need to catch up. Just begin with prayer.'),
      };

    default:
      return {
        title: 'Open siFia',
        message: 'A quiet next step is waiting for you.',
      };
  }
}
