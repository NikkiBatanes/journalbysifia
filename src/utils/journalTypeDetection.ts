/**
 * Journal Type Detection Utility
 * Automatically detects appropriate journal types based on subtask text content
 */

export type JournalType =
  | 'prayer'
  | 'reflection'
  | 'gratitude'
  | 'win'
  | 'timeblock'
  | 'none';

interface JournalTypePattern {
  type: JournalType;
  keywords: string[];
  phrases: string[];
}

// Define patterns for detecting journal types
const JOURNAL_TYPE_PATTERNS: JournalTypePattern[] = [
  {
    type: 'prayer',
    keywords: ['pray', 'prayer', 'god', 'lord', 'jesus', 'christ', 'holy', 'spirit', 'faith', 'worship', 'blessing', 'divine', 'sacred', 'spiritual'],
    phrases: ['pray for', 'ask god', 'seek god', 'talk to god', 'pray about', 'bring to god', 'god\'s guidance', 'pray that', 'prayer time', 'spend time with god'],
  },
  {
    type: 'reflection',
    keywords: ['reflect', 'reflection', 'think', 'consider', 'contemplate', 'ponder', 'meditate', 'analyze', 'examine', 'evaluate', 'assess', 'review'],
    phrases: ['reflect on', 'think about', 'consider how', 'look back', 'examine your', 'analyze your', 'evaluate your', 'assess your', 'review your', 'contemplate your'],
  },
  {
    type: 'gratitude',
    keywords: ['grateful', 'gratitude', 'thankful', 'appreciate', 'blessing', 'blessed', 'thank', 'praise', 'acknowledge'],
    phrases: ['grateful for', 'thankful for', 'appreciate the', 'count your blessings', 'give thanks', 'express gratitude', 'acknowledge the', 'be thankful', 'feel grateful'],
  },
  {
    type: 'win',
    keywords: ['celebrate', 'achievement', 'success', 'accomplish', 'victory', 'milestone', 'progress', 'win', 'triumph', 'breakthrough'],
    phrases: ['celebrate your', 'acknowledge your success', 'recognize your progress', 'celebrate the', 'acknowledge your achievement', 'record your wins', 'note your progress'],
  },
  {
    type: 'timeblock',
    keywords: ['schedule', 'time', 'calendar', 'block', 'plan', 'allocate', 'dedicate', 'set aside', 'organize', 'structure'],
    phrases: ['schedule time', 'block time', 'set aside time', 'allocate time', 'plan your time', 'organize your schedule', 'time management', 'dedicate time'],
  },
];

/**
 * Detects the most appropriate journal type for a given subtask text
 */
export function detectJournalType(text: string): JournalType {
  if (!text || text.trim().length === 0) {
    return 'none';
  }

  const lowerText = text.toLowerCase();
  let bestMatch: { type: JournalType; score: number } = { type: 'none', score: 0 };

  for (const pattern of JOURNAL_TYPE_PATTERNS) {
    let score = 0;

    // Check for exact phrase matches (higher weight)
    for (const phrase of pattern.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        score += 3; // Phrases get higher weight
      }
    }

    // Check for keyword matches
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Update best match if this pattern scores higher
    if (score > bestMatch.score) {
      bestMatch = { type: pattern.type, score };
    }
  }

  // Return the best match if it has a reasonable score, otherwise 'none'
  return bestMatch.score >= 1 ? bestMatch.type : 'none';
}

/**
 * Detects multiple journal types for a subtask (returns comma-separated string)
 */
export function detectMultipleJournalTypes(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'none';
  }

  const lowerText = text.toLowerCase();
  const matches: { type: JournalType; score: number }[] = [];

  for (const pattern of JOURNAL_TYPE_PATTERNS) {
    let score = 0;

    // Check for exact phrase matches (higher weight)
    for (const phrase of pattern.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        score += 3;
      }
    }

    // Check for keyword matches
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    if (score >= 1) {
      matches.push({ type: pattern.type, score });
    }
  }

  // Sort by score and return top matches
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    return 'none';
  }

  // Return top 2 matches if they have decent scores
  const topMatches = matches.slice(0, 2).filter(match => match.score >= 1);
  return topMatches.map(match => match.type).join(',');
}

/**
 * Processes a playbook and adds journal type detection to all subtasks
 */
export function addJournalTypesToPlaybook(playbook: any): any {
  if (!playbook || !playbook.actionSteps) {
    return playbook;
  }

  const updatedActionSteps = playbook.actionSteps.map((step: any) => {
    if (!step.subTasks || !Array.isArray(step.subTasks)) {
      return step;
    }

    const updatedSubTasks = step.subTasks.map((subTask: any) => {
      const text = typeof subTask === 'string' ? subTask : subTask.text;
      const detectedType = detectJournalType(text);

      if (typeof subTask === 'string') {
        // Convert string subtask to object with detected journal type
        return {
          id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: subTask,
          completed: false,
          detected_journal_type: detectedType !== 'none' ? detectedType : undefined,
        };
      } else {
        // Add detected journal type to existing object
        return {
          ...subTask,
          detected_journal_type: detectedType !== 'none' ? detectedType : undefined,
        };
      }
    });

    return {
      ...step,
      subTasks: updatedSubTasks,
    };
  });

  return {
    ...playbook,
    actionSteps: updatedActionSteps,
  };
}
