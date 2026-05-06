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
  reflectionLine?: string;
  heartJournalTitle?: string;
  personName?: string;
  personNames?: string[];
  remainingCount?: number;
  refreshDate?: string;
  prayerText?: string;
  isPrayerRequest?: boolean;
  _simulatedDayOfWeek?: number;
  completedCount?: number;
  totalCount?: number;
}

const formatNameList = (names: string[]): string => {
  if (names.length === 1) { return names[0]; }
  if (names.length === 2) { return `${names[0]} and ${names[1]}`; }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

const compact = (str: string, maxLength = Number.POSITIVE_INFINITY): string => {
  if (!str) {return '';}
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
};

/**
 * Sanitizes playbook title to prevent devotional-style titles like "Day 2"
 * If the title looks like a devotional day title, return a fallback
 */
const sanitizePlaybookTitle = (title?: string | null): string => {
  if (!title) {return 'Playbook';}

  // Check if title matches devotional day pattern (e.g., "Day 1", "Day 2", etc.)
  const dayPattern = /^Day \d+$/i;
  if (dayPattern.test(title.trim())) {
    return 'Playbook'; // Fallback to generic title
  }

  return title;
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
      const isSingleDay = context.totalDays === 1;
      // Single-day: use devotional title. Multi-day: "Day X: Title" or "Day X" if no title.
      const dayLabel = isSingleDay
        ? (context.title || 'Your devotional')
        : context.dayNumber
          ? (context.title ? `Day ${context.dayNumber}: ${context.title}` : `Day ${context.dayNumber}`)
          : (context.title || 'Your next day');
      return {
        title: 'Your devotional is ready',
        message: compact(`${dayLabel} is ready when you are.`),
      };
    }

    case 'devotional_prayer_prompt':
      return {
        title: 'Pray today\'s devotional',
        message: compact('Take a moment to pray the prayer for today.'),
      };

    case 'devotional_reflection_prompt':
      return {
        title: 'Pause with this question',
        message: compact(context.questionText || 'Take a moment to reflect on today\'s question.'),
      };

    case 'devotional_verse_revisit': {
      const verseMessage = context.verseText
        ? (context.verseReference ? `${context.verseReference} — ${context.verseText}` : context.verseText)
        : 'A verse from your devotional is worth revisiting today.';
      return {
        title: 'Carry this verse today',
        message: compact(verseMessage),
      };
    }

    case 'devotional_completed_reflection':
      return {
        title: 'Reflect on today\'s devotional',
        message: compact('You finished today\'s devotional. What is staying with you?'),
      };

    case 'playbook_word_to_speak':
      return {
        title: 'Speak this over now',
        message: compact(context.wordToSpeak || 'One word from your playbook is ready to speak over yourself.'),
      };

    case 'playbook_faithful_action': {
      const faithfulTitles = [
        'Take one faithful step',
        'Return to your next step',
        'Come back to the step in front of you',
      ];
      const faithfulDay = context._simulatedDayOfWeek ?? new Date().getDay();
      return {
        title: faithfulTitles[faithfulDay % faithfulTitles.length],
        message: compact(context.actionText || 'One action from your playbook is ready for today.'),
      };
    }

    case 'playbook_verse_revisit': {
      const pbVerseMessage = context.verseText
        ? (context.verseReference ? `${context.verseReference} — ${context.verseText}` : context.verseText)
        : 'The verse from your playbook is worth carrying today.';
      return {
        title: 'Return to the verse',
        message: compact(pbVerseMessage),
      };
    }

    case 'playbook_verse_reflection':
      return {
        title: 'A word worth carrying',
        message: compact(context.reflectionLine || 'Revisit the reflection from your Scripture anchor today.'),
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

    case 'playbook_actions_complete':
      return {
        title: 'Faithful actions complete 🏆',
        message: compact(`You finished every faithful action in "${sanitizePlaybookTitle(context.title)}". One step at a time, you kept going.`),
      };

    case 'playbook_actions_milestone': {
      const completed = context.completedCount || 0;
      const total = context.totalCount || 0;
      return {
        title: 'Faithful actions progress 💪🏼',
        message: compact(`You've completed ${completed} of ${total} faithful actions in "${sanitizePlaybookTitle(context.title)}". Keep taking one faithful step at a time.`),
      };
    }

    case 'journal_todays_focus':
      return {
        title: 'Name today\'s focus',
        message: compact('What needs your focus before the day gets crowded? Set it before God.'),
      };

    case 'journal_todo':
      return {
        title: 'Choose your next step',
        message: compact('One to-do can become today\'s faithful step.'),
      };

    case 'journal_gratitude':
      return {
        title: 'Notice today\'s gifts',
        message: compact('Name three things you want to thank God for today.'),
      };

    case 'journal_todays_win':
      return {
        title: 'Name today\'s win',
        message: compact('Before the day closes, name where you saw grace.'),
      };

    case 'journal_looking_forward':
      return {
        title: 'Look toward tomorrow',
        message: compact('What are you looking forward to tomorrow? God\'s grace will meet you there.'),
      };

    case 'heart_journal_prompt':
      return {
        title: 'Take a quiet moment to reflect',
        message: compact(context.heartJournalTitle || 'Check in with your heart'),
      };

    case 'prayer_answered_check': {
      if (context.personName) {
        if (context.isPrayerRequest) {
          return {
            title: compact(`Still praying for ${context.personName}?`, 58),
            message: compact('Has their prayer request been answered?'),
          };
        }
        return {
          title: compact(`Following up on your prayer for ${context.personName}`, 58),
          message: compact('Has God moved in this? Mark it answered when the time comes.'),
        };
      }
      return {
        title: 'Was this prayer answered?',
        message: compact(context.prayerText || 'Take a moment to check — has God answered?'),
      };
    }

    case 'prayer_request_care': {
      if (context.personNames && context.personNames.length >= 2) {
        const nameList = formatNameList(context.personNames.slice(0, 5));
        return {
          title: compact(`Lift ${nameList} in prayer`, 58),
          message: compact('Take a quiet moment to bring them before God.'),
        };
      }
      return {
        title: compact(context.personName ? `Lift ${context.personName} in prayer today` : 'Lift someone up today', 58),
        message: compact(context.personName ? `Take a quiet moment to bring ${context.personName} before God.` : 'Take a quiet moment to pray for them.'),
      };
    }

    case 'prayer_today':
      return {
        title: 'Begin with prayer',
        message: compact('Bring today before God for a quiet minute.'),
      };

    case 'prayer_people_nudge':
      return {
        title: 'Lift someone in prayer today',
        message: compact('Someone on your heart may need prayer today. Take a moment to bring them before God.'),
      };

    case 'create_first_devotional':
      return {
        title: 'Create your first devotional',
        message: compact('Turn your completed playbook into a devotional to spend time in prayer, reflection, and scripture.'),
      };

    case 'create_devotional':
      return {
        title: 'Start a new devotional',
        message: compact('Turn a completed playbook into a devotional to spend time in prayer, reflection, and scripture.'),
      };

    case 'create_playbook': {
      const playbookMessages = [
        'Begin with the moment that needs clarity today.',
        'Take a moment to process what needs clarity today.',
        'Start with the moment you need help sorting through.',
        'Use this space to process what feels tangled today.',
        'Pause and work through the moment in front of you.',
        'Start with the moment you do not want to react to too quickly.',
      ];
      const createDay = context._simulatedDayOfWeek ?? new Date().getDay();
      return {
        title: 'Start a new playbook',
        message: compact(playbookMessages[createDay % playbookMessages.length]),
      };
    }

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
        message: compact('Upgrade for more room to keep going with new playbooks and devotionals.'),
      };

    case 'daily_review':
      return {
        title: compact('Look back on your day, {name} 🌿'),
        message: compact('Take a moment to revisit your focus, reflection, or prayer from today.'),
      };

    default:
      return {
        title: 'Open siFia',
        message: 'A quiet next step is waiting for you.',
      };
  }
}
