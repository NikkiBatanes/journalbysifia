export const JOURNAL_BLOCK_KIND_IDS = [
  'text',
  'section',
  'action',
  'bullets',
  'numbered',
  'column',
  'photo',
  'voice',
  'scripture',
  'key',
  'quote',
  'song',
  'outline',
  'character',
  'language',
  'link',
  'table',
  'history',
  'remember',
  'response',
  'question',
  'reflection_question',
  'revisit',
  'prayer',
  'book',
] as const;

export type JournalBlockKind = (typeof JOURNAL_BLOCK_KIND_IDS)[number];
export type SelectableJournalBlockKind = Exclude<JournalBlockKind, 'text'>;

export const NOTE_BLOCK_CONTEXTS = [
  'reflection',
  'scripture',
  'session',
] as const;
export type NoteBlockContext = (typeof NOTE_BLOCK_CONTEXTS)[number];

export const NOTE_BLOCK_CATEGORIES = [
  {id: 'writing', label: 'Writing'},
  {id: 'structure', label: 'Structure'},
  {id: 'capture', label: 'Capture'},
  {id: 'highlights', label: 'Highlights'},
  {id: 'reflect', label: 'Reflect & Act'},
  {id: 'resources', label: 'Resources'},
  {id: 'study', label: 'Bible Study'},
] as const;
export type NoteBlockCategory = (typeof NOTE_BLOCK_CATEGORIES)[number]['id'];

export type NoteBlockRenderMode =
  | 'plain'
  | 'special'
  | 'list'
  | 'column'
  | 'table'
  | 'inline'
  | 'advanced';

export interface JournalBlockConfig {
  label: string;
  action: string;
  placeholder: string;
  icon: string;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
}

export interface NoteBlockDefinition extends JournalBlockConfig {
  kind: JournalBlockKind;
  pickerLabel: string;
  description: string;
  category: NoteBlockCategory;
  selectable: boolean;
  allowInColumn: boolean;
  renderMode: NoteBlockRenderMode;
  /** Lower values appear first in a context's default picker. */
  contextOrder: Partial<Record<NoteBlockContext, number>>;
  /** Stable order for the historical generic inline subset. */
  genericOrder?: number;
}

const allContexts = (order: number) => ({
  reflection: order,
  scripture: order,
  session: order,
});

/**
 * Canonical catalog for every structured note block in the app.
 *
 * Persisted entries store only `kind`, so user-facing labels, grouping, and
 * context availability can evolve here without migrating saved notes.
 */
export const NOTE_BLOCK_REGISTRY = {
  text: {
    kind: 'text',
    label: 'NOTE',
    pickerLabel: 'Write',
    action: 'Write',
    description: 'Write a free-form note.',
    placeholder: 'Write…',
    icon: 'pencil-outline',
    category: 'writing',
    selectable: false,
    allowInColumn: true,
    renderMode: 'plain',
    contextOrder: allContexts(-1),
  },
  section: {
    kind: 'section',
    label: 'SECTION',
    pickerLabel: 'Section',
    action: 'Section',
    description: 'Create a heading that organizes related notes.',
    placeholder: 'Section title',
    icon: 'text-outline',
    category: 'structure',
    selectable: true,
    allowInColumn: true,
    renderMode: 'special',
    contextOrder: allContexts(0),
  },
  action: {
    kind: 'action',
    label: 'ACTION',
    pickerLabel: 'Action',
    action: 'Action',
    description: 'Capture a next step that can be checked off.',
    placeholder: 'Add an action item…',
    icon: 'checkbox-outline',
    category: 'reflect',
    selectable: true,
    allowInColumn: true,
    renderMode: 'special',
    contextOrder: allContexts(1),
  },
  bullets: {
    kind: 'bullets',
    label: 'Bullets',
    pickerLabel: 'Bullets',
    action: 'Bullets',
    description: 'Capture an unordered list.',
    placeholder: 'List item',
    icon: 'list-outline',
    category: 'structure',
    selectable: true,
    allowInColumn: true,
    renderMode: 'list',
    contextOrder: allContexts(2),
  },
  numbered: {
    kind: 'numbered',
    label: 'Numbered',
    pickerLabel: 'Numbered',
    action: 'Numbered',
    description: 'Capture an ordered list.',
    placeholder: 'List item',
    icon: 'list-circle-outline',
    category: 'structure',
    selectable: true,
    allowInColumn: true,
    renderMode: 'list',
    contextOrder: allContexts(3),
  },
  column: {
    kind: 'column',
    label: '2 COLUMNS',
    pickerLabel: '2 Columns',
    action: '2 Columns',
    description: 'Arrange related notes in two side-by-side columns.',
    placeholder: '',
    icon: 'view-split-vertical',
    iconFamily: 'MaterialCommunityIcons',
    category: 'structure',
    selectable: true,
    allowInColumn: false,
    renderMode: 'column',
    contextOrder: allContexts(4),
  },
  photo: {
    kind: 'photo',
    label: 'PHOTO',
    pickerLabel: 'Photo',
    action: 'Photo',
    description: 'Add a photo with an optional caption.',
    placeholder: 'Add a caption…',
    icon: 'image-outline',
    category: 'capture',
    selectable: true,
    allowInColumn: true,
    renderMode: 'special',
    contextOrder: allContexts(6),
  },
  voice: {
    kind: 'voice',
    label: 'VOICE NOTE',
    pickerLabel: 'Voice Note',
    action: 'Voice Note',
    description: 'Record an audio note with optional text.',
    placeholder: 'Add a note…',
    icon: 'mic-outline',
    category: 'capture',
    selectable: true,
    allowInColumn: true,
    renderMode: 'special',
    contextOrder: allContexts(7),
  },
  scripture: {
    kind: 'scripture',
    label: 'SCRIPTURE',
    pickerLabel: 'Scripture',
    action: '+ Scripture',
    description: 'Look up and keep a Bible passage.',
    placeholder: 'Romans 12:1–2',
    icon: 'book-outline',
    category: 'highlights',
    selectable: true,
    allowInColumn: true,
    renderMode: 'inline',
    genericOrder: 0,
    contextOrder: allContexts(8),
  },
  key: {
    kind: 'key',
    label: 'KEY POINT',
    pickerLabel: 'Key Point',
    action: '★ Key Point',
    description: 'Emphasize the main idea to carry forward.',
    placeholder: 'What is the main idea?',
    icon: 'star-outline',
    category: 'highlights',
    selectable: true,
    allowInColumn: true,
    renderMode: 'inline',
    genericOrder: 2,
    contextOrder: allContexts(9),
  },
  quote: {
    kind: 'quote',
    label: 'QUOTE',
    pickerLabel: 'Quote',
    action: '“ ” Quote',
    description: 'Capture someone’s words with attribution.',
    placeholder: 'Write the speaker’s words…',
    icon: 'chatbox-outline',
    category: 'highlights',
    selectable: true,
    allowInColumn: true,
    renderMode: 'inline',
    genericOrder: 1,
    contextOrder: allContexts(10),
  },
  song: {
    kind: 'song',
    label: 'WORSHIP SONG',
    pickerLabel: 'Worship Song',
    action: '♪ Worship Song',
    description: 'Keep a worship song and its artist.',
    placeholder: 'Song title',
    icon: 'musical-note-outline',
    category: 'resources',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(17),
  },
  outline: {
    kind: 'outline',
    label: 'MESSAGE OUTLINE',
    pickerLabel: 'Message Outline',
    action: '☷ Outline',
    description: 'Organize the main movements of a message.',
    placeholder: 'Outline Title',
    icon: 'list-outline',
    category: 'study',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(20),
  },
  character: {
    kind: 'character',
    label: 'BIBLE CHARACTER',
    pickerLabel: 'Bible Character',
    action: '♙ Bible Character',
    description: 'Capture observations about a person in Scripture.',
    placeholder: 'Name',
    icon: 'person-circle-outline',
    category: 'study',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(21),
  },
  language: {
    kind: 'language',
    label: 'LANGUAGE NOTE',
    pickerLabel: 'Language Note',
    action: 'א Language Note',
    description: 'Study an original-language word and its meaning.',
    placeholder: 'Original Word',
    icon: 'translate',
    iconFamily: 'MaterialCommunityIcons',
    category: 'study',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(22),
  },
  link: {
    kind: 'link',
    label: 'LINK',
    pickerLabel: 'Link',
    action: 'Link',
    description: 'Keep a related website or resource.',
    placeholder: 'Paste or type a link',
    icon: 'link-outline',
    category: 'resources',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(19),
  },
  table: {
    kind: 'table',
    label: 'TABLE',
    pickerLabel: 'Table',
    action: '▦ Table',
    description: 'Compare information in rows and columns.',
    placeholder: '',
    icon: 'grid-outline',
    category: 'structure',
    selectable: true,
    allowInColumn: false,
    renderMode: 'table',
    contextOrder: allContexts(5),
  },
  history: {
    kind: 'history',
    label: 'HISTORICAL CONTEXT',
    pickerLabel: 'Historical Context',
    action: 'Historical Context',
    description: 'Record background about an era, place, or culture.',
    placeholder: 'Why does this background matter?',
    icon: 'map-outline',
    category: 'study',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(23),
  },
  remember: {
    kind: 'remember',
    label: 'REMEMBER',
    pickerLabel: 'Remember',
    action: '♡ Remember',
    description: 'Mark something you do not want to forget.',
    placeholder: 'What do you not want to forget?',
    icon: 'heart-outline',
    category: 'highlights',
    selectable: true,
    allowInColumn: true,
    renderMode: 'inline',
    genericOrder: 3,
    contextOrder: allContexts(11),
  },
  response: {
    kind: 'response',
    label: 'RESPONSE',
    pickerLabel: 'Response',
    action: '→ Response',
    description: 'Write how you want to respond or put truth into practice.',
    placeholder: 'What do you want to put into practice?',
    icon: 'arrow-forward-outline',
    category: 'reflect',
    selectable: true,
    allowInColumn: true,
    renderMode: 'inline',
    genericOrder: 5,
    contextOrder: allContexts(13),
  },
  question: {
    kind: 'question',
    label: 'QUESTION',
    pickerLabel: 'Question',
    action: '? Question',
    description: 'Keep a question you want to explore.',
    placeholder: 'What question came up as you listened?',
    icon: 'help-circle-outline',
    category: 'reflect',
    selectable: true,
    allowInColumn: true,
    renderMode: 'inline',
    genericOrder: 4,
    contextOrder: allContexts(12),
  },
  reflection_question: {
    kind: 'reflection_question',
    label: 'REFLECTION QUESTION',
    pickerLabel: 'Reflection Question',
    action: '◆ Reflection Question',
    description: 'Write a reflection question together with your answer.',
    placeholder: 'What is the reflection question?',
    icon: 'chatbubbles-outline',
    category: 'reflect',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(15),
  },
  revisit: {
    kind: 'revisit',
    label: 'REVISIT',
    pickerLabel: 'Revisit',
    action: '↻ Revisit',
    description: 'Mark something to return to later.',
    placeholder: 'What do you want to come back to later?',
    icon: 'refresh-outline',
    category: 'reflect',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(16),
  },
  prayer: {
    kind: 'prayer',
    label: 'PRAYER',
    pickerLabel: 'Prayer',
    action: 'Prayer',
    description: 'Turn what you are noticing into prayer.',
    placeholder: 'Turn this moment into prayer…',
    icon: 'leaf-outline',
    category: 'reflect',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(14),
  },
  book: {
    kind: 'book',
    label: 'BOOK TO READ',
    pickerLabel: 'Book to Read',
    action: '📕 Book to read',
    description: 'Keep a book recommendation and author.',
    placeholder: 'Book title',
    icon: 'book-outline',
    category: 'resources',
    selectable: true,
    allowInColumn: false,
    renderMode: 'advanced',
    contextOrder: allContexts(18),
  },
} as const satisfies Record<JournalBlockKind, NoteBlockDefinition>;

type Registry = typeof NOTE_BLOCK_REGISTRY;

export type JournalBlockKindForContext<C extends NoteBlockContext> = {
  [K in JournalBlockKind]: C extends keyof Registry[K]['contextOrder'] ? K : never;
}[JournalBlockKind];

export const isJournalBlockKind = (value: unknown): value is JournalBlockKind =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(NOTE_BLOCK_REGISTRY, value);

export const getNoteBlockDefinitionsForContext = (
  context: NoteBlockContext,
  options: {includeWrite?: boolean} = {},
): NoteBlockDefinition[] =>
  (Object.values(NOTE_BLOCK_REGISTRY) as NoteBlockDefinition[])
    .filter(
      definition =>
        context in definition.contextOrder &&
        (options.includeWrite || definition.selectable),
    )
    .sort(
      (left, right) =>
        (left.contextOrder[context] ?? Number.MAX_SAFE_INTEGER) -
        (right.contextOrder[context] ?? Number.MAX_SAFE_INTEGER),
    );

export const getGenericInlineBlockDefinitions = (): NoteBlockDefinition[] =>
  (Object.values(NOTE_BLOCK_REGISTRY) as NoteBlockDefinition[])
    .filter(definition => definition.genericOrder !== undefined)
    .sort(
      (left, right) =>
        (left.genericOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.genericOrder ?? Number.MAX_SAFE_INTEGER),
    );

export const isBlockAllowedInContext = (
  kind: JournalBlockKind,
  context: NoteBlockContext,
) => context in NOTE_BLOCK_REGISTRY[kind].contextOrder;
