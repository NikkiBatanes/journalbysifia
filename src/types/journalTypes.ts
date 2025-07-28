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
    focus: 'focus',
    win: 'win',
    forward: 'forward',
    todos: 'todos', // NEW: For actionable tasks

    // Financial types (detected but fallback to reflection until components are built)
    financial_tithing: 'financial_tithing',
    financial_savings: 'financial_savings',
    financial_expenses: 'financial_expenses',
    financial_investment: 'financial_investment',
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

// Financial Entry Interface
export interface SmartFinancialEntry {
    id: string;
    sub_task_id: string;
    user_id: string;
    financial_type: 'tithing' | 'savings' | 'expenses' | 'investment';
    amount: number;
    description?: string;
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
    focus: {
        type: 'focus',
        displayName: "Today's Focus",
        icon: 'target',
        color: '#10B981',
        description: 'Daily priorities and focus areas',
        isImplemented: true,
        purpose: 'Setting main priorities and key objectives',
        keywords: ['priority', 'priorities', 'focus', 'main objective', 'key', 'important', 'top 3', 'primary', 'set priorities', 'choose priority'],
    },
    win: {
        type: 'win',
        displayName: "Today's Win",
        icon: 'trophy',
        color: '#F59E0B',
        description: 'Daily victories and achievements',
        isImplemented: true,
        purpose: 'Recording accomplishments and celebrating progress',
        keywords: ['accomplish', 'achievement', 'success', 'victory', 'celebrate', 'progress', 'completed', 'won', 'record what', 'track progress', 'acknowledge', 'small victories', 'victories', 'improvements', 'wins', 'recognize'],
    },
    forward: {
        type: 'forward',
        displayName: 'Looking Forward',
        icon: 'arrow-right',
        color: '#06B6D4',
        description: 'Future planning and anticipation',
        isImplemented: true,
        purpose: 'Long-term planning and future vision setting',
        keywords: ['future', 'long-term', 'vision', 'next year', 'upcoming', 'plan ahead', 'looking forward', 'anticipate'],
    },
    todos: {
        type: 'todos',
        displayName: 'To-Dos',
        icon: 'check-square',
        color: '#EF4444',
        description: 'Actionable tasks and checklist items',
        isImplemented: true,
        purpose: 'Specific actionable tasks to complete',
        keywords: ['task', 'do', 'complete', 'action', 'check off', 'finish', 'specific task', 'actionable', 'choose a task', 'set a timer', 'create', 'make', 'schedule', 'appointment', 'list', 'document', 'call', 'send', 'write down', 'keep', 'maintain', 'keep journal', 'keep log', 'track'],
    },
    financial_tithing: {
        type: 'financial_tithing',
        displayName: 'Tithing',
        icon: 'dollar-sign',
        color: '#059669',
        description: 'Tithing and giving tracking',
        isImplemented: false,
        fallbackType: 'reflection',
    },
    financial_savings: {
        type: 'financial_savings',
        displayName: 'Savings',
        icon: 'piggy-bank',
        color: '#0D9488',
        description: 'Savings goals and tracking',
        isImplemented: false,
        fallbackType: 'reflection',
    },
    financial_expenses: {
        type: 'financial_expenses',
        displayName: 'Expenses',
        icon: 'receipt',
        color: '#DC2626',
        description: 'Expense tracking and budgeting',
        isImplemented: false,
        fallbackType: 'reflection',
    },
    financial_investment: {
        type: 'financial_investment',
        displayName: 'Investment',
        icon: 'trending-up',
        color: '#7C3AED',
        description: 'Investment tracking and stewardship',
        isImplemented: false,
        fallbackType: 'reflection',
    },
};

// Helper Functions
export function isFinancialType(type: string): boolean {
    return type.startsWith('financial_');
}

export function getJournalTypeMetadata(type: JournalType): JournalTypeMetadata {
    return JOURNAL_TYPE_REGISTRY[type];
}

export function getImplementedJournalTypes(): JournalType[] {
    return Object.values(JOURNAL_TYPE_REGISTRY)
        .filter(meta => meta.isImplemented)
        .map(meta => meta.type);
}

export function getFinancialJournalTypes(): JournalType[] {
    return Object.values(JOURNAL_TYPE_REGISTRY)
        .filter(meta => isFinancialType(meta.type))
        .map(meta => meta.type);
}

// Trigger Keywords for Detection (for reference)
export const JOURNAL_TYPE_KEYWORDS: Record<JournalType, string[]> = {
    none: ['attend', 'read', 'share', 'keep diary', 'track', 'meeting', 'book', 'seminar', 'regular activity'],
    reflection: ['reflect', 'think', 'consider', 'ponder', 'meditate', 'contemplate'],
    gratitude: ['grateful', 'gratitude', 'thankful', 'appreciate', 'blessing', 'blessed'],
    prayer: ['pray', 'prayer', 'worship', 'spiritual', 'God', 'Lord', 'Jesus'],
    timeblock: ['schedule', 'time', 'calendar', 'appointment', 'block', 'dedicate time'],
    focus: ['priority', 'focus', 'important', 'main', 'key', 'primary'],
    win: ['win', 'victory', 'achievement', 'success', 'accomplish', 'celebrate'],
    forward: ['tomorrow', 'future', 'plan', 'next', 'upcoming', 'look forward'],
    todos: ['task', 'to-do', 'action', 'complete', 'checklist', 'actionable'],
    financial_tithing: ['tithe', 'tithing', 'giving', 'donate', 'offering', '10%'],
    financial_savings: ['save', 'savings', 'emergency fund', 'budget', 'financial goal'],
    financial_expenses: ['expense', 'spending', 'cost', 'budget', 'money', 'purchase'],
    financial_investment: ['invest', 'investment', 'portfolio', 'stocks', 'financial planning'],
};
