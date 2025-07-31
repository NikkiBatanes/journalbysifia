// Journal Type Definitions for Smart Journaling System
// Phase 1: Database Foundation

export const JOURNAL_TYPES = {
    // Special types
    none: 'none', // For subtasks that don't need journaling

    // Implemented types (existing components)
    reflection: 'reflection',
    gratitude: 'gratitude',
    prayer: 'prayer',
    timeblock: 'timeblock',
} as const;

export type JournalType = typeof JOURNAL_TYPES[keyof typeof JOURNAL_TYPES];

// Journal Entry Interface
export interface SmartJournalEntry {
    id: string;
    sub_task_id: string;
    user_id: string;
    journal_type: JournalType;
    content: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}



// Expounded Step Interface
export interface SmartExpoundedStep {
    id: string;
    action_step_id: string;
    expounded_content: string;
    hard_truth_content?: string;
    created_at: string;
    updated_at: string;
}

// Journal Type Metadata for UI
export interface JournalTypeMetadata {
    type: JournalType;
    displayName: string;
    icon: string;
    color: string;
    description: string;
    isImplemented: boolean;
    fallbackType?: JournalType;
    keywords?: string[];
    purpose?: string;
}

// Journal Type Registry
export const JOURNAL_TYPE_REGISTRY: Record<JournalType, JournalTypeMetadata> = {
    none: {
        type: 'none',
        displayName: 'No Journaling',
        icon: 'minus-circle',
        color: '#9CA3AF',
        description: 'Task does not require journaling',
        isImplemented: true,
        purpose: 'Regular tasks that don\'t need journal components',
        keywords: ['attend', 'read', 'share', 'keep diary', 'track', 'meeting', 'book', 'seminar', 'regular activity', 'commit', 'spend time', 'dedicate time', 'follow', 'practice', 'maintain', 'behavioral change', 'lifestyle change', 'pray for', 'ask god'],
    },
    reflection: {
        type: 'reflection',
        displayName: 'Reflection',
        icon: 'book-open',
        color: '#6B7280',
        description: 'Personal reflection and thoughts',
        isImplemented: true,
        purpose: 'Deep thinking, analysis, planning, and self-assessment',
        keywords: ['analyze', 'identify', 'evaluate', 'assess', 'plan', 'strategy', 'create list', 'checklist', 'track progress', 'areas', 'goals', 'improve', 'cut back', 'develop plan', 'identify items', 'identify areas', 'evaluate options', 'think through', 'consider', 'determine', 'meditate', 'contemplate', 'prepare', 'prepare questions', 'prepare topics'],
    },
    gratitude: {
        type: 'gratitude',
        displayName: 'Gratitude',
        icon: 'heart',
        color: '#F59E0B',
        description: 'Things you are grateful for',
        isImplemented: true,
        purpose: 'Expressing thankfulness and appreciation',
        keywords: ['grateful', 'thankful', 'appreciate', 'blessing', 'positive', 'good things', 'list things', 'grateful for'],
    },
    prayer: {
        type: 'prayer',
        displayName: 'Prayer',
        icon: 'hands-praying',
        color: '#8B5CF6',
        description: 'Prayer requests and spiritual communication',
        isImplemented: true,
        purpose: 'Spiritual communication and seeking divine guidance',
        keywords: ['pray', 'prayer', 'ask God', 'seek God', 'spiritual', 'intercession', 'supplication', 'petition', 'pray for', 'asking God', 'seek guidance', 'spiritual request', 'pray for God to', 'pray for wisdom', 'pray for peace', 'pray for help', 'pray for ability', 'God to help', 'God to reveal'],
    },
    timeblock: {
        type: 'timeblock',
        displayName: 'Time Block',
        icon: 'clock',
        color: '#3B82F6',
        description: 'Schedule and time management',
        isImplemented: true,
        purpose: 'Scheduling specific time periods and calendar management',
        keywords: ['allocate time', 'schedule', 'time block', 'calendar', 'timer', 'specific time', 'when to', 'daily schedule', 'weekly schedule', 'set timer', 'time for', 'end of week', 'end of each week', 'weekly', 'daily', 'monthly', 'dedicate time', 'at least', 'minutes daily', 'specific times', 'establish routine', 'each day', 'every morning', 'every evening', 'time each day'],
    },
};

// Helper Functions
export function getJournalTypeMetadata(type: JournalType): JournalTypeMetadata {
    return JOURNAL_TYPE_REGISTRY[type];
}

export function getImplementedJournalTypes(): JournalType[] {
    return Object.values(JOURNAL_TYPE_REGISTRY)
        .filter(meta => meta.isImplemented)
        .map(meta => meta.type);
}

// Trigger Keywords for Detection (for reference)
export const JOURNAL_TYPE_KEYWORDS: Record<JournalType, string[]> = {
    none: ['attend', 'read', 'share', 'keep diary', 'track', 'meeting', 'book', 'seminar', 'regular activity'],
    reflection: ['reflect', 'think', 'consider', 'ponder', 'meditate', 'contemplate'],
    gratitude: ['grateful', 'gratitude', 'thankful', 'appreciate', 'blessing', 'blessed'],
    prayer: ['pray', 'prayer', 'worship', 'spiritual', 'God', 'Lord', 'Jesus'],
    timeblock: ['schedule', 'time', 'calendar', 'appointment', 'block', 'dedicate time'],
};
