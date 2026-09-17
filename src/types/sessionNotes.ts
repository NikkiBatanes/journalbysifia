// Session Note types — the single document-level classification for the shared
// structured note editor (SermonNotesScreen). This is intentionally distinct
// from Heart Journal's `journalClassification` ('notes' etc.): it classifies
// the canonical sermon_notes reflection document, not a Heart Journal entry.
export const SESSION_NOTE_TYPES = [
  { value: 'sermon', label: 'Sermon', documentLabel: 'Sermon Notes' },
  { value: 'conference', label: 'Conference', documentLabel: 'Conference Notes' },
  { value: 'speaking', label: 'Speaking', documentLabel: 'Speaking Notes' },
  { value: 'meeting', label: 'Meeting', documentLabel: 'Meeting Notes' },
  { value: 'workshop', label: 'Workshop', documentLabel: 'Workshop Notes' },
  { value: 'other', label: 'Other', documentLabel: 'Session Notes' },
] as const;

export type SessionNoteType = typeof SESSION_NOTE_TYPES[number]['value'];

export type SessionNoteDetailKey = 'event' | 'topic' | 'location';

export interface SessionNoteUiConfig {
  displayLabel: string;
  shortLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  personLabel: string;
  personPlaceholder: string;
  details: ReadonlyArray<{key: SessionNoteDetailKey; label: string; placeholder: string}>;
  savedCopy: string;
  rememberedCopy: string;
  reflectedCopy: string;
  includesCopy: string;
  viewCopy: string;
}

const detail = (key: SessionNoteDetailKey, label: string, placeholder: string) => ({key, label, placeholder});

const SESSION_NOTE_CONFIGS: Record<SessionNoteType, SessionNoteUiConfig> = {
  sermon: {
    displayLabel: 'Sermon Notes', shortLabel: 'Sermon', titleLabel: 'Sermon title', titlePlaceholder: 'Title of the message...',
    personLabel: 'Pastor / Speaker', personPlaceholder: 'Pastor name...', details: [detail('event', 'Series', 'The Book of Romans...'), detail('topic', 'Main Scripture', 'Romans 12:1–2...'), detail('location', 'Church / Event', 'Where you heard it...')],
    savedCopy: 'Your sermon notes are saved. Here’s what you captured from the message.', rememberedCopy: 'SERMON REMEMBERED', reflectedCopy: 'Sermon reflected', includesCopy: 'YOUR SERMON NOW INCLUDES', viewCopy: 'View sermon',
  },
  conference: {
    displayLabel: 'Conference Notes', shortLabel: 'Conference', titleLabel: 'Session title', titlePlaceholder: 'Title of the session...', personLabel: 'Speaker', personPlaceholder: 'Speaker name...',
    details: [detail('event', 'Conference / Event', 'Conference or event...'), detail('topic', 'Topic / Track', 'Topic or track...'), detail('location', 'Location', 'Location...')], savedCopy: 'Your conference notes are saved. Here’s what you captured.', rememberedCopy: 'CONFERENCE REMEMBERED', reflectedCopy: 'Conference reflected', includesCopy: 'YOUR CONFERENCE NOW INCLUDES', viewCopy: 'View conference notes',
  },
  speaking: {
    displayLabel: 'Speaking Notes', shortLabel: 'Speaking', titleLabel: 'Talk title', titlePlaceholder: 'Title of the talk...', personLabel: 'Speaker / Presenter', personPlaceholder: 'Speaker or presenter...',
    details: [detail('event', 'Event', 'Event...'), detail('topic', 'Topic / Theme', 'Topic or theme...'), detail('location', 'Location', 'Location...')], savedCopy: 'Your speaking notes are saved. Here’s what you captured.', rememberedCopy: 'TALK REMEMBERED', reflectedCopy: 'Talk reflected', includesCopy: 'YOUR TALK NOW INCLUDES', viewCopy: 'View speaking notes',
  },
  meeting: {
    displayLabel: 'Meeting Notes', shortLabel: 'Meeting', titleLabel: 'Meeting title', titlePlaceholder: 'Title of the meeting...', personLabel: 'People / Team', personPlaceholder: 'People or team...',
    details: [detail('event', 'Organization / Group', 'Organization or group...'), detail('topic', 'Topic / Agenda', 'Topic or agenda...'), detail('location', 'Location', 'Location...')], savedCopy: 'Your meeting notes are saved. Here’s what you captured.', rememberedCopy: 'MEETING REMEMBERED', reflectedCopy: 'Meeting reflected', includesCopy: 'YOUR MEETING NOW INCLUDES', viewCopy: 'View meeting notes',
  },
  workshop: {
    displayLabel: 'Workshop Notes', shortLabel: 'Workshop', titleLabel: 'Workshop title', titlePlaceholder: 'Title of the workshop...', personLabel: 'Facilitator / Speaker', personPlaceholder: 'Facilitator or speaker...',
    details: [detail('event', 'Workshop / Event', 'Workshop or event...'), detail('topic', 'Topic / Theme', 'Topic or theme...'), detail('location', 'Location', 'Location...')], savedCopy: 'Your workshop notes are saved. Here’s what you captured.', rememberedCopy: 'WORKSHOP REMEMBERED', reflectedCopy: 'Workshop reflected', includesCopy: 'YOUR WORKSHOP NOW INCLUDES', viewCopy: 'View workshop notes',
  },
  other: {
    displayLabel: 'Session Notes', shortLabel: 'Session', titleLabel: 'Note title', titlePlaceholder: 'Title of the note...', personLabel: 'Person / Speaker', personPlaceholder: 'Person or speaker...',
    details: [detail('event', 'Event / Context', 'Event or context...'), detail('topic', 'Topic', 'Topic...'), detail('location', 'Location', 'Location...')], savedCopy: 'Your session notes are saved. Here’s what you captured.', rememberedCopy: 'SESSION REMEMBERED', reflectedCopy: 'Session reflected', includesCopy: 'YOUR SESSION NOW INCLUDES', viewCopy: 'View session notes',
  },
};

export const getSessionNoteConfig = (value: unknown): SessionNoteUiConfig =>
  SESSION_NOTE_CONFIGS[normalizeSessionNoteType(value)];

export const getSessionNoteContext = (metadata: Record<string, any> | null | undefined, value: unknown) => {
  const type = normalizeSessionNoteType(value);
  if (type === 'sermon') return {person: metadata?.speaker || '', event: metadata?.series || '', topic: metadata?.main_scripture || '', location: metadata?.church || ''};
  const saved = metadata?.sessionNoteDetails?.[type] || {};
  return {person: saved.person || '', event: saved.event || '', topic: saved.topic || '', location: saved.location || ''};
};

export const sessionNoteSearchMetadata = (metadata: Record<string, any> | null | undefined) => {
  const type = resolveSessionNoteType({metadata});
  const context = getSessionNoteContext(metadata, type);
  return [sessionNoteTypeLabel(type), context.person, context.event, context.topic, context.location].filter(Boolean);
};

export const getSessionNoteReflectionCopy = (value: unknown, scripture?: string) => {
  if (normalizeSessionNoteType(value) === 'sermon') return [
    {eyebrow: 'GOD', title: 'What does this show you about God?', subtitle: 'Take a moment with what you heard and what Scripture revealed.'},
    {eyebrow: 'TRUTH', title: 'What truth from Scripture do you want to hold onto?', subtitle: scripture ? `Hold onto a truth rooted in ${scripture}.` : 'Take a moment with what you heard and what Scripture revealed.'},
    {eyebrow: 'RESPONSE', title: 'How will you respond?', subtitle: 'Reflect on how this truth shapes your next step.'},
    {eyebrow: 'PRAYER', title: 'What do you want to bring to God in prayer?', subtitle: 'Speak to God about what this sermon has stirred in you.'},
  ];
  return [
    {eyebrow: 'NOTICE', title: 'What stands out from your notes?', subtitle: 'Take a moment with what you heard, discussed, or learned.'},
    {eyebrow: 'REMEMBER', title: 'What do you want to remember?', subtitle: 'Capture the idea or detail you want to carry forward.'},
    {eyebrow: 'RESPONSE', title: 'How will you respond?', subtitle: 'Reflect on any next step that feels important.'},
    {eyebrow: 'PRAYER', title: 'What do you want to bring to God in prayer?', subtitle: 'Bring anything from this session that is on your heart.'},
  ];
};

export const isSessionNoteType = (value: unknown): value is SessionNoteType =>
  SESSION_NOTE_TYPES.some(item => item.value === value);

// Legacy structured notes predate `metadata.sessionNoteType`; they were all
// Sermon Notes, so the fallback resolves to 'sermon' without mutating records.
export const normalizeSessionNoteType = (value: unknown): SessionNoteType =>
  isSessionNoteType(value) ? value : 'sermon';

export const resolveSessionNoteType = (entry?: {
  metadata?: Record<string, any> | null;
} | null): SessionNoteType =>
  normalizeSessionNoteType(entry?.metadata?.sessionNoteType);

// Display label for the document kind, e.g. 'Sermon Notes' / 'Session Notes'.
export const sessionNoteTypeLabel = (value: unknown): string =>
  SESSION_NOTE_TYPES.find(item => item.value === normalizeSessionNoteType(value))!
    .documentLabel;

// Short picker label, e.g. 'Sermon' / 'Other'.
export const sessionNoteTypeName = (value: unknown): string =>
  SESSION_NOTE_TYPES.find(item => item.value === normalizeSessionNoteType(value))!
    .label;
