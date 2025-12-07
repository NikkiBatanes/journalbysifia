import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Logger } from '../../../utils/ProductionLogger';
import { View, StyleSheet, SectionList, RefreshControlProps, TouchableOpacity } from 'react-native';
import { Feather } from 'lucide-react-native';
import { JournalPlugin } from '../types';
import { PluginRenderer } from '../PluginRenderer';
import { Colors } from '../../../theme/colors';
import { format, startOfMonth, endOfMonth, getWeek } from 'date-fns';
import { getWeekStart, getWeekEnd, WeekStartDay } from '../../../utils/weekStartUtils';
import ThemedText from '../../../components/common/ThemedText';
import { useTheme } from '../../../hooks/useTheme';
import { getFontFamily } from '../../../theme/fonts';
import { GroupingType, SortType } from '../../../components/moments/GroupingControls';
import { DateRange } from '../../../components/moments/DateFilterBar';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../context/IndustryStandardAuthContext';
import { triggerLightHaptic } from '../../../utils/haptics';
import MomentsSkeleton from '../../../components/SkeletonLoader/MomentsSkeleton';
import type { PluginFilters } from '../types';

// Removed unused screenWidth variable

interface EnhancedMomentsRendererProps {
  plugins: JournalPlugin[];
  dateRange: DateRange;
  refreshKey?: number;
  groupBy: GroupingType;
  sortBy: SortType;
  searchQuery: string;
  style?: any;
  headerComponents?: React.ReactElement[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  prayerAnswerFilter?: 'all' | 'answered' | 'unanswered';
  filterKeys?: Array<'upcoming' | 'unansweredPrayers' | 'answeredPrayers' | 'reflectionJournals' | 'prayers' | 'prayerRequests' | 'gratitude' | 'todaysWin' | 'planCarousel'>;
  // Optional handler for empty-state CTA button
  onAddPress?: () => void;
}

interface MomentEntry {
  plugin: JournalPlugin;
  date: Date;
  category: string;
  type: string;
  isAnswered?: boolean; // only for Prayer entries
  // derived flags for filtering
  _isPrayer?: boolean;
  _isReflection?: boolean;
  _isGratitude?: boolean;
  _isWin?: boolean;
  _isPlan?: boolean;
  _isPrayerRequest?: boolean;
  _searchText?: string;
}

interface GroupedSection {
  title: string;
  data: any[];  // For non-week: MomentEntry[][] (carousel groups). For week: WeekItem[]
  key: string;
}

interface WeekItem {
  key: string; // `${monthKey}::${weekKey}`
  start: Date;
  end: Date;
  title: string; // Week range title
  entries: MomentEntry[];
}

interface MonthItem {
  key: string; // `${yearKey}::${monthKey}`
  start: Date;
  end: Date;
  title: string; // Month title (hide year if current year)
  entries: MomentEntry[];
}

// Shared ordering helpers to guarantee consistent order across all views
const TYPE_ORDER = {
  focus: 0,
  todos: 1,
  timeblocks: 2,
  gratitude: 3,
  reflection: 4,
  prayerjournal: 5,
  devotionalprayers: 6,
  peopleprayers: 7,
  win: 100, // both today's and yesterday's
  lookingforward: 101,
} as const;

const textToOrderKey = (text: string): keyof typeof TYPE_ORDER | null => {
  const s = (text || '').toLowerCase();
  if (s.includes("today's focus") || s.includes('todays focus') || s.includes('focus')) {return 'focus';}
  if (s === 'todo' || s.includes('todo')) {return 'todos';}
  // Time blocks (including common typos like timebloack)
  if (s.includes('time block') || s.includes('timeblocks') || s.includes('timeblock') || s.includes('time blocks') || s.includes('timebloack')) {return 'timeblocks';}
  // Gratitude
  if (s.includes('gratitude list') || s.includes('gratitude')) {return 'gratitude';}
  // Reflection variants
  if (s.includes('reflections') || s.includes('reflection journal') || s.includes('reflection')) {return 'reflection';}
  // Prayer journal
  if (s.includes('prayer journal')) {return 'prayerjournal';}
  // Devotional prayers
  if (s.includes('devotional prayers') || s.includes('prayed devotional')) {return 'devotionalprayers';}
  // People prayers
  if (s.includes('prayer list for people') || s.includes('prayer list') || s.includes('people prayer') || s.includes('people')) {return 'peopleprayers';}
  // Win
  if (s.includes("today's win") || s.includes('todays win') || s.includes("yesterday's win") || s.includes('yesterdays win') || s === 'win') {return 'win';}
  // Looking forward
  if (s.includes('looking forward to') || s.includes('looking forward')) {return 'lookingforward';}
  return null;
};

const normalizePluginIdToKey = (pidRaw: string): keyof typeof TYPE_ORDER | null => {
  const pid = (pidRaw || '').toLowerCase();
  if (!pid) {return null;}
  // Direct matches
  if (pid in TYPE_ORDER) {return pid as keyof typeof TYPE_ORDER;}
  // Common aliases -> canonical keys
  if (pid === 'todo') {return 'todos';}
  if (pid === 'timeblock' || pid === 'timeblocks' || pid === 'time-blocks') {return 'timeblocks';}
  if (pid === 'gratitude' || pid === 'gratitudejournal') {return 'gratitude';}
  if (pid === 'reflection' || pid === 'reflections' || pid === 'reflectionjournal') {return 'reflection';}
  if (pid === 'prayer-journal' || pid === 'openprayer' || pid === 'actsprayer') {return 'prayerjournal';}
  if (pid === 'devotional' || pid === 'devotional-prayers' || pid === 'prayeddevotional') {return 'devotionalprayers';}
  if (pid === 'people' || pid === 'people-prayers' || pid === 'prayerpeople' || pid === 'prayerlist') {return 'peopleprayers';}
  if (pid === 'win' || pid === 'wins' || pid === 'yesterdayswin') {return 'win';}
  if (pid === 'lookingforwardto' || pid === 'looking-forward') {return 'lookingforward';}
  if (pid === "today's focus" || pid === 'todaysfocus' || pid === 'focus-today') {return 'focus';}
  return null;
};

const getEntryRank = (entry: Partial<MomentEntry>): number => {
  const pid = entry?.plugin?.id?.toLowerCase?.() || '';
  const normalized = normalizePluginIdToKey(pid);
  if (normalized) {return TYPE_ORDER[normalized];}
  const keyFromType = textToOrderKey((entry as any)?.type || entry?.plugin?.title || (entry as any)?.category || '');
  if (keyFromType) {return TYPE_ORDER[keyFromType];}
  return 50;
};

const parseIfJsonString = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const flattenToString = (value: unknown): string => {
  if (value === undefined || value === null) {return '';}
  if (typeof value === 'string') {return value;}
  if (typeof value === 'number' || typeof value === 'boolean') {return String(value);}
  if (Array.isArray(value)) {
    return value
      .map((item: unknown) => flattenToString(item))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item: unknown) => flattenToString(item))
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

const buildSearchText = (...values: unknown[]): string => {
  const parts: string[] = [];
  values.forEach((raw) => {
    if (raw === undefined || raw === null) {return;}
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = parseIfJsonString(trimmed);
        parts.push(flattenToString(parsed));
      } else {
        parts.push(trimmed);
      }
      return;
    }
    parts.push(flattenToString(raw));
  });

  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

// Create dynamic styles function
const createStyles = (fonts: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 0,
    // Allow ListEmptyComponent to occupy full height so content can center vertically
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.anchorBlue,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: Colors.textGray,
  },
  momentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.alertCoral,
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 40,
  },
  momentContent: {
    flex: 1,
  },
  momentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  momentDate: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: Colors.textGray,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: Colors.alertCoral,
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: Colors.textGray,
    textAlign: 'center',
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  carouselContainer: {
    marginBottom: 16,
  },
  carousel: {
    flexGrow: 0,
  },
  carouselContent: {
    paddingHorizontal: 8,
  },
  carouselItem: {
    width: '100%',
    marginHorizontal: 0,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.alertCoral,
  },
  // Week nested UI styles
  weekCardContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  weekCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  weekRangeTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  weekCountsText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: Colors.textGray,
  },
  weekExpandedBody: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  weekRangeOverline: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: Colors.textGray,
    marginBottom: 4,
  },
  dayHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dayHeaderText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  // Devotional-specific carousel styling (center-snap like onboarding)
  devoCarouselContent: {
    paddingVertical: 0,
  },
  devoCarouselItem: {
    marginVertical: 0,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    alignSelf: 'stretch',
  },
  devoFullWidthCard: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 0,
  },
  devoHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  devoEdgeToEdge: {
    // Break out of the header padding so the FlatList can render full-bleed
    marginHorizontal: -16,
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  // New styles for cleaned up inline styles
  chevronIcon: {
    marginRight: 8,
    fontSize: 18,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
  },
  transparentBackground: {
    backgroundColor: 'transparent',
  },
  columnLayout: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  chevronVisible: {
    opacity: 1,
  },
  chevronHidden: {
    opacity: 0,
  },
  weekTitleSpacing: {
    marginTop: 2,
  },
  countsSpacing: {
    marginTop: 4,
  },
});

export const EnhancedMomentsRenderer: React.FC<EnhancedMomentsRendererProps> = ({
  plugins,
  dateRange,
  refreshKey,
  groupBy,
  sortBy,
  searchQuery,
  style,
  headerComponents = [],
  refreshControl,
  prayerAnswerFilter = 'all',
  filterKeys = [],
  onAddPress,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  // Create dynamic fonts object
  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  // Use memoized styles with dynamic fonts
  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const { user } = useAuth();
  // Removed unused insets variable
  const [realEntries, setRealEntries] = React.useState<MomentEntry[]>([]);
  const [_loading, setLoading] = React.useState(true);
  const hasLoadedOnce = useRef(false);

  // Derive plugin-level filters to pass into plugin components so they respect Moments filters
  const pluginFilters: PluginFilters | undefined = useMemo(() => {
    const keys = filterKeys || [];
    const hasAnsweredOnly = keys.includes('answeredPrayers') && !keys.includes('unansweredPrayers');
    const hasUnansweredOnly = keys.includes('unansweredPrayers') && !keys.includes('answeredPrayers');
    if (hasAnsweredOnly) {
      return {
        answeredOnly: true,
        allowedJournalCategories: ['supplication', 'personal_prayer'],
        excludeJournalCategories: ['adoration', 'confession', 'thanksgiving'],
      };
    }
    if (hasUnansweredOnly) {
      return {
        answeredOnly: false,
        allowedJournalCategories: ['supplication', 'personal_prayer'], // Only show supplication and open prayers for unanswered filter
        excludeJournalCategories: ['adoration', 'confession', 'thanksgiving'],
      };
    }
    if (prayerAnswerFilter && prayerAnswerFilter !== 'all') {
      return {
        answeredOnly: prayerAnswerFilter === 'answered',
        allowedJournalCategories: ['supplication', 'personal_prayer'],
        excludeJournalCategories: ['adoration', 'confession', 'thanksgiving'],
      };
    }
    return undefined;
  }, [filterKeys, prayerAnswerFilter]);

  // Determine user's week start preference from auth user metadata if available; default to Sunday (0)
  const weekStartsOnPref = (user as any)?.user_metadata?.preferences?.weekStartsOn
    ?? (user as any)?.user_metadata?.weekStartsOn
    ?? (user as any)?.user_metadata?.preferences?.week_start
    ?? (user as any)?.user_metadata?.preferences?.weekStart
    ?? (user as any)?.user_metadata?.preferences?.week_start_on
    ?? (user as any)?.user_metadata?.preferences?.week_start_day;

  const weekStartsOn: WeekStartDay = React.useMemo(() => {
    try {
      const raw = weekStartsOnPref;

      if (typeof raw === 'number' && raw >= 0 && raw <= 6) {

        return raw as WeekStartDay;
      }
      if (typeof raw === 'string') {
        const val = raw.trim().toLowerCase();
        const map: Record<string, WeekStartDay> = {
          '0': 0, 'sun': 0, 'sunday': 0,
          '1': 1, 'mon': 1, 'monday': 1,
          '2': 2, 'tue': 2, 'tues': 2, 'tuesday': 2,
          '3': 3, 'wed': 3, 'wednesday': 3,
          '4': 4, 'thu': 4, 'thur': 4, 'thurs': 4, 'thursday': 4,
          '5': 5, 'fri': 5, 'friday': 5,
          '6': 6, 'sat': 6, 'saturday': 6,
        };
        if (val in map) {

          return map[val];
        }
      }
    } catch (_) {
      // ignore and use default
    }

    return 0;
  }, [weekStartsOnPref]);

  // Fetch real journal entries from user interactions - NOT generated content
  const fetchRealEntries = React.useCallback(async () => {
    if (!user) {
      setRealEntries([]);
      setLoading(false);
      return;
    }

    try {
      // CRITICAL: Never show loading skeleton on refetches - only on first mount
      // This prevents flickering when refreshKey changes from Today's Focus updates
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      let entries: MomentEntry[] = [];
      // dayReflectionCount removed - was defined but never used

      // Fetch real journal entries from user interactions - NOT generated content
      try {
        // Fetch journal entries (todos, today's focus, gratitude, etc.) - the main user content
        const { data: journalEntries, error: journalEntriesError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Check specifically for July 31 entries in raw data
        if (journalEntries) {
          const july31RawEntries = journalEntries.filter(entry => {
            const selectedDate = entry.selected_date ? new Date(entry.selected_date) : null;
            const createdDate = new Date(entry.created_at);

            const selectedIsJuly31 = selectedDate && selectedDate.getMonth() === 6 && selectedDate.getDate() === 31;
            const createdIsJuly31 = createdDate.getMonth() === 6 && createdDate.getDate() === 31;

            return selectedIsJuly31 || createdIsJuly31;
          });

          if (july31RawEntries.length > 0) {

          } else {

          }
        }

        if (!journalEntriesError && journalEntries && journalEntries.length > 0) {

          // Process journal entries

          journalEntries.forEach(entry => {
            // Check if entry has meaningful content (or is a devotional marker)
            const hasTextContent = entry.content && (
                typeof entry.content === 'string' ? entry.content.trim().length > 0 :
                typeof entry.content === 'object' ? Object.keys(entry.content).length > 0 : true);

            // Detect devotional saved in journal_entries
            const devoStrings = [
              (entry as any).content_type,
              (entry as any).source,
              (entry as any).type,
              (entry as any).journal_category,
              (entry as any).action,
            ].filter(Boolean) as string[];
            const devoBooleans = [
              (entry as any).prayed_devo,
              (entry as any).is_devo,
              (entry as any).is_devotional,
              (entry as any).prayedDevotional,
            ].filter(v => typeof v === 'boolean') as boolean[];
            const isDevotionalJE =
              devoStrings.some(v => {
                const s = (v || '').toLowerCase();
                return s.includes('devo') || s.includes('devotional') || s.includes('devotion');
              }) || devoBooleans.some(Boolean);

            const hasContent = hasTextContent || isDevotionalJE;

            if (hasContent) {

              // Find appropriate plugin based on content_type
              let plugin = null;

              // Map content types to plugin searches - focus on plan/reflect/pray/devo plugins
              const contentTypeMap: Record<string, string[]> = {
                'gratitude': ['gratitude', 'reflect', 'journal'],
                'todo': ['todo', 'task', 'plan', 'journal'],
                'today_win': ['win', 'reflect', 'journal'],
                'looking_forward': ['forward', 'reflect', 'journal'],
                'todays_focus': ['focus', 'plan', 'journal'],
                'prayed_devotional': ['devotional', 'devo', 'prayer', 'journal'],
                'devotional': ['devotional', 'devo', 'journal'],
                // Add reflection-specific mappings
                'reflection': ['reflection', 'journal'],
                'free': ['reflection', 'journal'],
                'guided': ['reflection', 'journal'],
                'heart_journal': ['reflection', 'journal'],
                'smart_journaling': ['reflection', 'journal'],
              };

              const searchTerms = contentTypeMap[entry.content_type] || (isDevotionalJE ? ['devotional', 'devo'] : ['journal']);

              for (const term of searchTerms) {
                plugin = plugins.find((p: JournalPlugin) =>
                  p.title.toLowerCase().includes(term.toLowerCase())
                );
                if (plugin) {

                  break;
                }
              }

              // Final fallback - use any available plugin
              if (!plugin && plugins.length > 0) {
                plugin = plugins[0];

              }

              if (plugin) {
                // Create readable type names
                const typeNames: Record<string, string> = {
                  'gratitude': 'Gratitude List',
                  'todo': 'Todo',
                  'today_win': "Today's Win",
                  'looking_forward': 'Looking Forward To',
                  'todays_focus': "Today's Focus",
                  'prayed_devotional': 'Prayed Devotional',
                  'devotional': 'Devotional',
                };

                // Prefer a Prayer plugin for devotional journal entries so they appear under Prayer Journal.
                // Fallback to a Devotional plugin if no prayer plugin exists.
                const prayerPluginFromJE =
                  plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer journal')) ||
                  plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer list')) ||
                  plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer')) ||
                  plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('pray')) ||
                  plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('prayer')) ||
                  null as any;

                const devoPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('devotional') || p.title.toLowerCase().includes('devo')) ||
                                   plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('devotional')) ||
                                   null as any;

                // Prefer Devotional plugin for devo journal entries; fallback to Prayer plugin
                const selectedPlugin = isDevotionalJE ? (devoPlugin || prayerPluginFromJE || plugin) : plugin;

                // Check if this is a prayer-related journal entry that needs filtering
                const isPrayerJournalEntry = isDevotionalJE ||
                                           entry.content_type === 'prayed_devotional' ||
                                           (entry as any).journal_category ||
                                           (entry as any).prayer_type;

                let shouldIncludeJournalEntry = true;

                if (isPrayerJournalEntry) {
                  // Let all prayer journal entries through initially - the secondary filter will handle answered/category filtering
                  shouldIncludeJournalEntry = true;

                }

                if (shouldIncludeJournalEntry) {
                  const entryDate = new Date(entry.selected_date || entry.created_at);
                  const dateKey = entryDate.toDateString();
                  // pluginKey removed - was calculated but never used

                  // Check if we already have an entry for this plugin on this date
                  const existingEntry = entries.find(e =>
                    e.plugin.id === selectedPlugin.id &&
                    e.date.toDateString() === dateKey
                  );

                  if (!existingEntry) {
                    // Only create one entry per plugin per date
                    const momentEntry = {
                      plugin: selectedPlugin,
                      date: entryDate,
                      category: isDevotionalJE ? 'Prayer' : 'Journal',
                      type: isDevotionalJE ? 'Prayed Devotional' : (typeNames[entry.content_type] || entry.content_type || 'Journal Entry'),
                      _searchText: buildSearchText(
                        entry.content,
                        (entry as any)?.title,
                        (entry as any)?.subtitle,
                        (entry as any)?.summary,
                        (entry as any)?.notes,
                        (entry as any)?.prompt,
                        (entry as any)?.metadata,
                      ),
                    };

                    entries.push(momentEntry);
                  }
                }
              }
            }
          });

        } else {

        }

        // Note: Reflections are processed later in the existing reflections query section

        // Fetch user prayer entries (from pray carousel interactions)
        const { data: prayers, error: prayersError } = await supabase
          .from('prayers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!prayersError && prayers && prayers.length > 0) {

          // Check specifically for August 1-2 prayer entries
          const august12Prayers = prayers.filter(prayer => {
            const selectedDate = prayer.selected_date ? new Date(prayer.selected_date) : null;
            const createdDate = new Date(prayer.created_at);

            const selectedIsAugust12 = selectedDate && selectedDate.getMonth() === 7 && (selectedDate.getDate() === 1 || selectedDate.getDate() === 2);
            const createdIsAugust12 = createdDate.getMonth() === 7 && (createdDate.getDate() === 1 || createdDate.getDate() === 2);

            return selectedIsAugust12 || createdIsAugust12;
          });

          if (august12Prayers.length > 0) {

          } else {

          }

          // Try to find the best prayer plugin - prefer Prayer Journal, then Prayer List, then any prayer plugin
          let prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer journal'));
          if (!prayerPlugin) {
            prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer list'));
          }
          if (!prayerPlugin) {
            prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer'));
          }
          // Fallback by category if titles don't contain the word 'prayer'
          if (!prayerPlugin) {
            prayerPlugin = plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('pray')) ||
                           plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('prayer')) ||
                           null as any;
          }
          // Final generic fallback
          if (!prayerPlugin && plugins.length > 0) {
            prayerPlugin = plugins[0];
          }
          // Also identify a Devotional plugin for devo prayers
          const devoPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('devotional') || p.title.toLowerCase().includes('devo')) ||
                             plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('devotional')) ||
                             null as any;
          // Identify People/Prayer List plugin for people prayers
          const peoplePlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer list')) || null as any;

          if (prayerPlugin) {
            prayers.forEach(prayer => {
              // Consider entries with journal_category or devotional markers as valid even if text fields are empty
              const rawContent = (prayer as any).content;
              const contentText = typeof rawContent === 'string' ? rawContent : (prayer as any).prayer_text || '';
              const contentObj = typeof rawContent === 'object' && rawContent !== null ? rawContent as any : null;
              const hasText = typeof contentText === 'string' ? contentText.trim().length > 0 : false;
              const hasObjectContent = contentObj ? Object.keys(contentObj).length > 0 : false;
              // Common list fields for people/prayer list structures
              const hasPeopleList = Array.isArray((prayer as any).people) && (prayer as any).people.length > 0;
              const hasPrayerList = Array.isArray((prayer as any).prayer_list) && (prayer as any).prayer_list.length > 0;
              const devoStrings = [
                (prayer as any).source,
                (prayer as any).type,
                (prayer as any).journal_category,
                (prayer as any).action,
              ].filter(Boolean) as string[];
              const devoBooleans = [
                (prayer as any).prayed_devo,
                (prayer as any).is_devo,
                (prayer as any).is_devotional,
                (prayer as any).prayedDevotional,
              ].filter(v => typeof v === 'boolean') as boolean[];
              // Treat explicit devotional types/metadata as devotional too
              const devotionalByType = ((prayer as any).prayer_type || '').toString().toLowerCase() === 'devotional';
              const devotionalByMetadata = !!((prayer as any).devotional_title || (prayer as any).day_number || (prayer as any).day_title || (prayer as any).total_days);

              const isDevotional =
                devotionalByType ||
                devotionalByMetadata ||
                devoStrings.some(v => {
                  const s = (v || '').toLowerCase();
                  return s.includes('devo') || s.includes('devotional') || s.includes('devotion');
                }) || devoBooleans.some(Boolean);

              const shouldIncludePrayer = true;

              const hasUserContent = hasText || hasObjectContent || hasPeopleList || hasPrayerList || !!(prayer as any).journal_category || isDevotional;

              if (hasUserContent && shouldIncludePrayer) {
                // Parse date-only strings as local midnight to avoid off-by-one issues
                const selected = (prayer as any).selected_date as string | null;
                const entryDate = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected)
                  ? new Date(`${selected}T00:00:00`)
                  : new Date((prayer as any).selected_date || (prayer as any).created_at);

                // Compute type label with explicit mapping for people prayers
                const prayerTypeForLabel = ((prayer as any).prayer_type || '').toString().toLowerCase();
                const typeLabel = isDevotional
                  ? 'Prayed Devotional'
                  : prayerTypeForLabel === 'people'
                    ? 'Prayer List'
                    : ((prayer as any).journal_category
                        ? ((prayer as any).journal_category as string).charAt(0).toUpperCase() + ((prayer as any).journal_category as string).slice(1) + ' Prayer'
                        : 'Prayer');

                // Select plugin based on prayer type
                // - Devotional -> Devotional plugin preferred
                // - People -> Prayer List plugin preferred
                // - Others -> Prayer Journal/general Prayer plugin
                const targetPlugin = isDevotional
                  ? (devoPlugin || prayerPlugin)
                  : (prayerTypeForLabel === 'people'
                      ? (peoplePlugin || prayerPlugin)
                      : prayerPlugin);

                const prayerEntry = {
                  plugin: targetPlugin,
                  date: entryDate,
                  category: 'Prayer',
                  type: typeLabel,
                  isAnswered: ((prayer as any).is_answered === true) || ((prayer as any).status === 'answered') || !!(prayer as any).answered_date,
                  _isPrayerRequest: (prayer as any)?.is_prayer_request === true,
                  _searchText: buildSearchText(
                    contentText,
                    contentObj,
                    (prayer as any)?.title,
                    (prayer as any)?.name,
                    (prayer as any)?.notes,
                    (prayer as any)?.people,
                    (prayer as any)?.prayer_list,
                    (prayer as any)?.devotional_title,
                    (prayer as any)?.request,
                    (prayer as any)?.journal_category,
                    (prayer as any)?.prayer_type,
                  ),
                };

                entries.push(prayerEntry);
              } else {

              }
            });

          } else {

          }
        }

        // Fetch user reflections (from reflect carousel interactions)
        const { data: reflections, error: reflectionsError } = await supabase
          .from('reflection_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!reflectionsError && reflections && reflections.length > 0) {

          const reflectionPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('reflection'));

          if (reflectionPlugin) {
            reflections.forEach(reflection => {
              // Allow Reflection Journal of all subtypes: freeform, guided, devotional, playbook
              const typeStr = (reflection.type || '').toString().toLowerCase();
              const sourceStr = (reflection.source || '').toString().toLowerCase();
              const allowedType =
                typeStr === '' ||
                typeStr === 'free' ||
                typeStr === 'guided' ||
                typeStr === 'devotional' ||
                typeStr === 'playbook' ||
                typeStr.includes('freeform') ||
                typeStr.includes('guided') ||
                typeStr.includes('devotional') ||
                typeStr.includes('playbook');

              const allowedSource =
                sourceStr === '' ||
                sourceStr === 'freeform' ||
                sourceStr === 'guided' ||
                sourceStr === 'devotional' ||
                sourceStr === 'playbook' ||
                sourceStr.includes('freeform') ||
                sourceStr.includes('guided') ||
                sourceStr.includes('devotional') ||
                sourceStr.includes('playbook');

              // Check if reflection has content (string or object)
              const hasUserContent = reflection.content &&
                (typeof reflection.content === 'string' ? reflection.content.trim().length > 0 :
                 typeof reflection.content === 'object' ? Object.keys(reflection.content).length > 0 : true);

              if (hasUserContent && allowedType && allowedSource) {
                const entryDate = new Date(reflection.selected_date || reflection.created_at);
                const dateKey = entryDate.toDateString();

                // Check if we already have an entry for this plugin on this date
                const existingEntry = entries.find(e =>
                  e.plugin.id === reflectionPlugin.id &&
                  e.date.toDateString() === dateKey
                );

                if (!existingEntry) {
                  const reflectionEntry = {
                    plugin: reflectionPlugin,
                    date: entryDate,
                    category: 'Reflection',
                    type: reflection.type || 'Reflection',
                    _searchText: buildSearchText(
                      reflection.content,
                      (reflection as any)?.title,
                      (reflection as any)?.subtitle,
                      (reflection as any)?.prompt,
                      (reflection as any)?.notes,
                      (reflection as any)?.metadata,
                    ),
                  };

                  entries.push(reflectionEntry);
                } else {

                }
              } else {

              }
            });
          } else {

          }
        }

        // Fetch time blocks (user-created schedule entries)
        const { data: timeBlocks, error: timeBlocksError } = await supabase
          .from('time_blocks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!timeBlocksError && timeBlocks && timeBlocks.length > 0) {

          const normalizeDateString = (value?: string | null): string | null => {
            if (!value) {return null;}
            const trimmed = value.trim();
            if (!trimmed) {return null;}
            if (trimmed.includes('T')) {
              const [datePart] = trimmed.split('T');
              return datePart;
            }
            return trimmed;
          };

          const hasPassedEndDate = (selectedIso: string | null, endIso: string | null): boolean => {
            if (!selectedIso || !endIso) {return false;}
            try {
              const selectedTime = Date.parse(`${selectedIso}T00:00:00Z`);
              const endTime = Date.parse(`${endIso}T23:59:59Z`);
              if (!Number.isNaN(selectedTime) && !Number.isNaN(endTime)) {
                return selectedTime > endTime;
              }
            } catch {
              // fall through to string comparison
            }
            return selectedIso > endIso;
          };

          timeBlocks.forEach(timeBlock => {
            if (!timeBlock?.title || timeBlock.title.trim().length === 0) {
              return;
            }

            if (timeBlock.category === 'exception') {
              return;
            }

            const selectedDateIso = normalizeDateString(timeBlock.selected_date);
            const metadata = (timeBlock as any)?.metadata || {};
            const exceptionsRaw = Array.isArray(metadata?.exceptions) ? metadata.exceptions : [];
            const exceptionDates = exceptionsRaw
              .map((value: unknown) => (typeof value === 'string' ? normalizeDateString(value) : null))
              .filter((value: string | null): value is string => !!value);

            if (selectedDateIso && exceptionDates.includes(selectedDateIso)) {
              return;
            }

            const endDateIso = normalizeDateString(metadata?.endDate || timeBlock.repeat_until || timeBlock.repeat_end_date);
            if (hasPassedEndDate(selectedDateIso, endDateIso)) {
              return;
            }

            let plugin = plugins.find((p: JournalPlugin) =>
              p.title.toLowerCase().includes('schedule') ||
              p.title.toLowerCase().includes('time') ||
              p.title.toLowerCase().includes('plan')
            );

            if (!plugin && plugins.length > 0) {
              plugin = plugins[0];
            }

            if (!plugin) {
              return;
            }

            const entryDateIso = selectedDateIso || normalizeDateString(timeBlock.created_at);
            const entryDate = entryDateIso ? new Date(`${entryDateIso}T00:00:00`) : new Date(timeBlock.selected_date || timeBlock.created_at);

            entries.push({
              plugin,
              date: entryDate,
              category: 'Schedule',
              type: 'Time Block',
              _searchText: buildSearchText(
                timeBlock.title,
                (timeBlock as any)?.notes,
                (timeBlock as any)?.description,
                (timeBlock as any)?.metadata,
              ),
            });
          });
        }

      } catch (dbError) {

        // If database queries fail, don't show any entries
      }

      // Only set entries if we have real content
      // Check for duplicates before final processing
      // Build groups by day + plugin + type to detect duplicates across all times
      const duplicateCheck = entries.reduce((acc, entry, index) => {
        const day = format(entry.date, 'yyyy-MM-dd');
        const pluginId = (entry.plugin as any).id || entry.plugin.title;
        const key = `${day}::${pluginId}::${entry.type}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({ index, plugin: entry.plugin.title, date: entry.date, type: entry.type, category: entry.category });
        return acc;
      }, {} as Record<string, Array<{ index: number; plugin: string; date: Date; type: string; category: string }>>);

      const duplicates = Object.entries(duplicateCheck).filter(([_, list]) => list.length > 1);

      if (duplicates.length > 0) {

        // For each day+plugin+type, keep the most recent entry only
        const groupedByKey: Record<string, MomentEntry[]> = {};
        entries.forEach(entry => {
          const day = format(entry.date, 'yyyy-MM-dd');
          const pluginId = (entry.plugin as any).id || entry.plugin.title;
          const key = `${day}::${pluginId}::${entry.type}`;
          if (!groupedByKey[key]) {groupedByKey[key] = [];}
          groupedByKey[key].push(entry);
        });

        const kept: MomentEntry[] = [];
        const removed: Array<{ key: string; date: string; type: string; category: string; plugin: string }> = [];

        Object.entries(groupedByKey).forEach(([key, list]) => {
          const latest = list.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
          kept.push(latest);
          list.filter(e => e !== latest).forEach(e => removed.push({ key, date: e.date.toISOString(), type: e.type, category: e.category, plugin: e.plugin.title }));
        });

        if (removed.length > 0) {

        }

        entries = kept;

      }

      // Check specifically for July 31 entries
      const july31Entries = entries.filter(entry => {
        const entryDate = entry.date;
        return entryDate.getMonth() === 6 && entryDate.getDate() === 31; // July is month 6 (0-indexed)
      });

      if (july31Entries.length > 0) {

      } else {

      }

      // Check specifically for August 1-2 entries
      const august12Entries = entries.filter(entry => {
        const entryDate = entry.date;
        return entryDate.getMonth() === 7 && (entryDate.getDate() === 1 || entryDate.getDate() === 2); // August is month 7 (0-indexed)
      });

      if (august12Entries.length > 0) {

      } else {

      }

      setRealEntries(entries);
    } catch (error) {
      Logger.error('❌ [MomentsRenderer] Error fetching journal entries', error as Error, { component: 'EnhancedMomentsRenderer' });
      setRealEntries([]);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [user, plugins, refreshKey]);

  // Fetch entries when component mounts or dependencies change
  React.useEffect(() => {
    fetchRealEntries();
  }, [fetchRealEntries]);

  // Generate moment entries from real data
  const generateMomentEntries = React.useMemo(() => {

    // First filter by date range
    let filteredEntries = realEntries.filter(entry => {
      const entryDate = entry.date;
      const startDate = new Date(dateRange.startDate);
      let endDate = new Date(dateRange.endDate);

      // Set times to handle date comparison properly
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Clamp endDate to today's local end-of-day to avoid showing future-dated entries
      // EXCEPT when explicitly in Upcoming mode (we detect via dateRange.label)
      if ((dateRange.label || '').toLowerCase() !== 'upcoming') {
        const now = new Date();
        const todayEod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (endDate > todayEod) {
          endDate = todayEod;
        }
      }

      const isInRange = entryDate >= startDate && entryDate <= endDate;

      if (!isInRange) {

      } else {
        // Log entries that pass date filtering, especially for July 31 and August 1-2
        const isJuly31 = entryDate.getMonth() === 6 && entryDate.getDate() === 31;
        const isAugust12 = entryDate.getMonth() === 7 && (entryDate.getDate() === 1 || entryDate.getDate() === 2);

        if (isJuly31 || isAugust12) {

        }
      }

      return isInRange;
    });

    // Then filter by search query if provided
    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      filteredEntries = filteredEntries.filter(entry => {
        const pluginMatch = entry.plugin.title.toLowerCase().includes(normalizedQuery);
        const categoryMatch = (entry.category || '').toLowerCase().includes(normalizedQuery);
        const typeMatch = (entry.type || '').toLowerCase().includes(normalizedQuery);
        const textMatch = (entry._searchText || '').includes(normalizedQuery);
        return pluginMatch || categoryMatch || typeMatch || textMatch;
      });

    }

    // Derive category flags per entry for filtering
    filteredEntries = filteredEntries.map(e => {
      const type = (e.type || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();
      const isPrayer = cat === 'prayer';
      const isReflection = cat === 'reflection' || type.includes('reflection');
      const isGratitude = type.includes('gratitude');
      const isWin = type.includes("today's win") || type.includes('todays win');
      const isPlan = type.includes("today's focus") || type.includes('todays focus') || type.includes('todo') || type.includes('time block') || type.includes('timeblock');
      const isPrayerRequest = e._isPrayerRequest === true || ((e as any)?.type || '').toLowerCase().includes('request');
      return { ...e, _isPrayer: isPrayer, _isReflection: isReflection, _isGratitude: isGratitude, _isWin: isWin, _isPlan: isPlan, _isPrayerRequest: isPrayerRequest } as MomentEntry;
    });

    // Exclusive handling for answered/unanswered filters: if exactly one is selected, only show matching prayers
    const hasAnsweredOnly = filterKeys.includes('answeredPrayers') && !filterKeys.includes('unansweredPrayers');
    const hasUnansweredOnly = filterKeys.includes('unansweredPrayers') && !filterKeys.includes('answeredPrayers');

    if (hasAnsweredOnly || hasUnansweredOnly) {
      const wantAnswered = hasAnsweredOnly;
      filteredEntries = filteredEntries.filter(e => {
        if (!e._isPrayer) {return false;}

        // Check if prayer is answered/unanswered as requested
        const matchesAnsweredStatus = !!e.isAnswered === wantAnswered;

        if (!matchesAnsweredStatus) {return false;}

        // When showing unanswered prayers, exclude 'Prayer List for people'
        if (!wantAnswered) {
          const pid = (e as any)?.plugin?.id?.toLowerCase?.() || '';
          const ptitle = (e as any)?.plugin?.title?.toLowerCase?.() || '';
          const etype = (e.type || '').toLowerCase();
          const isPeoplePrayerList = pid === 'peopleprayers' || ptitle.includes('prayer list') || etype.includes('prayer list') || etype.includes('people');
          if (isPeoplePrayerList) {

            return false;
          }

          const isDevotionalPrayer = pid.includes('devotional') || ptitle.includes('devotional') || etype.includes('prayed devotional') || etype.includes('devotional');
          if (isDevotionalPrayer) {

            return false;
          }
        }

        // For answered prayers, hide confession, thanksgiving, and adoration completely
        if (wantAnswered) {
          // Get the prayer type from the entry type
          const entryType = (e.type || '').toLowerCase();

          // Hide these specific categories completely
          const isExcludedCategory = entryType.includes('confession') ||
                                   entryType.includes('thanksgiving') ||
                                   entryType.includes('adoration');

          // Only show if it's NOT an excluded category
          return !isExcludedCategory;
        }

        return true;
      });

      return filteredEntries;
    }

    // Apply category filters if any are selected (excluding upcoming and answered/unanswered which are handled separately)
    const categoryFilters = filterKeys.filter(k => k !== 'upcoming' && k !== 'answeredPrayers' && k !== 'unansweredPrayers');
    if (categoryFilters.length > 0) {
      filteredEntries = filteredEntries.filter(e => {
        return (
          (categoryFilters.includes('prayers') && e._isPrayer) ||
          (categoryFilters.includes('prayerRequests') && e._isPrayerRequest) ||
          (categoryFilters.includes('reflectionJournals') && e._isReflection) ||
          (categoryFilters.includes('gratitude') && e._isGratitude) ||
          (categoryFilters.includes('todaysWin') && e._isWin) ||
          (categoryFilters.includes('planCarousel') && e._isPlan)
        );
      });

    }

    // Skip legacy prayer answer filter if the new filterKeys system is handling it
    const isUsingNewFilterSystem = filterKeys.includes('answeredPrayers') || filterKeys.includes('unansweredPrayers');

    if (prayerAnswerFilter !== 'all' && !isUsingNewFilterSystem) {
      const wantAnswered = prayerAnswerFilter === 'answered';
      filteredEntries = filteredEntries.filter(entry => {
        if ((entry.category || '').toLowerCase() !== 'prayer') {return true;}
        return !!entry.isAnswered === wantAnswered;
      });

    }

    return filteredEntries;
  }, [realEntries, searchQuery, dateRange, prayerAnswerFilter, filterKeys]);

  // Sort entries (used in grouping logic)
  const sortedEntries = React.useMemo(() => {

    const sorted = [...generateMomentEntries];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
      case 'oldest':
        return sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
      case 'category':
        return sorted.sort((a, b) => {
          if (a.category === b.category) {
            return b.date.getTime() - a.date.getTime();
          }
          return a.category.localeCompare(b.category);
        });
      case 'type':
        return sorted.sort((a, b) => {
          if (a.type === b.type) {
            return b.date.getTime() - a.date.getTime();
          }
          return a.plugin.title.localeCompare(b.plugin.title);
        });
      default:
        return sorted;
    }
  }, [generateMomentEntries, sortBy]);

  // Track expanded week cards
  const [expandedWeeks, setExpandedWeeks] = React.useState<Record<string, boolean>>({});
  const [expandedMonths, setExpandedMonths] = React.useState<Record<string, boolean>>({});
  // Track expanded year in 'year' grouping
  const [expandedYears, setExpandedYears] = React.useState<Record<string, boolean>>({});

  // Group entries with carousel support (and nested Month > Week for 'week')
  const groupedSections = React.useMemo((): GroupedSection[] => {
    if (groupBy === 'none') {
      // For 'none' grouping, create carousel groups by type within the single section
      const typeGroups: Record<string, MomentEntry[]> = {};

      sortedEntries.forEach((entry) => {
        const typeKey = entry.type;
        if (!typeGroups[typeKey]) {
          typeGroups[typeKey] = [];
        }
        typeGroups[typeKey].push(entry);
      });

      // Build group list and enforce ordering similar to date grouping
      const groupEntries: { type: string; items: MomentEntry[]; repr: MomentEntry }[] = Object.entries(typeGroups).map(([type, items]) => {
        const sorted = items.sort((a, b) => b.date.getTime() - a.date.getTime());
        return { type, items: sorted, repr: sorted[0] };
      });

      const ordered = groupEntries.sort((a, b) => {
        const oa = getEntryRank(a.repr);
        const ob = getEntryRank(b.repr);
        if (oa !== ob) {return oa - ob;}
        return b.repr.date.getTime() - a.repr.date.getTime();
      });

      const carouselData = ordered.map(group => group.items);

      return [{
        title: 'All Moments',
        data: carouselData,
        key: 'all',
      }];
    }

    // Special handling for week: create Month sections containing Week items
    if (groupBy === 'week') {
      type MonthWeeks = Record<string, { start: Date; end: Date; key: string; entries: MomentEntry[]; title: string }>
      const byMonth: Record<string, MonthWeeks> = {};

      sortedEntries.forEach(entry => {
        const monthKey = format(startOfMonth(entry.date), 'yyyy-MM');
        const wkStart = getWeekStart(entry.date, weekStartsOn);
        const wkEnd = getWeekEnd(entry.date, weekStartsOn);
        const weekKey = format(wkStart, 'yyyy-MM-dd');
        const compositeKey = `${monthKey}::${weekKey}`;

        if (!byMonth[monthKey]) { byMonth[monthKey] = {}; }
        if (!byMonth[monthKey][weekKey]) {
          const monthLabel = format(entry.date, 'MMMM');
          const sameMonth = format(wkStart, 'MM') === format(wkEnd, 'MM');
          const title = sameMonth
            ? `${monthLabel} ${format(wkStart, 'd')}–${format(wkEnd, 'd')}, ${format(wkStart, 'yyyy')}`
            : `${format(wkStart, 'MMMM d')} – ${format(wkEnd, 'MMMM d')}, ${format(wkStart, 'yyyy')}`;
          byMonth[monthKey][weekKey] = { start: wkStart, end: wkEnd, key: compositeKey, entries: [], title };
        }
        byMonth[monthKey][weekKey].entries.push(entry);
      });

      // Build sections as months
      const sections: GroupedSection[] = Object.keys(byMonth).map(monthKey => {
        const monthDate = new Date(`${monthKey}-01T00:00:00`);
        const monthTitle = format(monthDate, 'MMMM yyyy');
        const weekItems: WeekItem[] = Object.values(byMonth[monthKey])
          .sort((a, b) => sortBy === 'oldest' ? a.start.getTime() - b.start.getTime() : b.start.getTime() - a.start.getTime())
          .map(w => ({ key: w.key, start: w.start, end: w.end, title: w.title, entries: w.entries }));

        return { title: monthTitle, data: weekItems, key: monthKey };
      });

      // If a week is expanded, hide the month list and emit a Week header section plus Day sections
      const expandedKeys = Object.keys(expandedWeeks).filter(k => !!expandedWeeks[k]);
      if (expandedKeys.length > 0) {
        const expandedKey = expandedKeys[0]; // exclusive behavior ensured elsewhere
        // expandedKey is composite `${monthKey}::${weekKey}` from existing code
        const [expandedMonthKey] = expandedKey.split('::');
        // Find the expanded week data
        const monthWeeks = byMonth[expandedMonthKey];
        let target: { start: Date; end: Date; key: string; entries: MomentEntry[]; title: string } | null = null;
        if (monthWeeks) {
          const wkKey = expandedKey.split('::')[1];
          const found = Object.values(monthWeeks).find(w => format(w.start, 'yyyy-MM-dd') === wkKey) ||
                        Object.values(monthWeeks).find(w => w.key === expandedKey);
          if (found) {target = found;}
        }

        if (target) {
          // Group entries by day
          const byDay = target.entries.reduce((acc, e) => {
            const k = format(e.date, 'yyyy-MM-dd');
            if (!acc[k]) {acc[k] = [] as MomentEntry[];}
            acc[k].push(e);
            return acc;
          }, {} as Record<string, MomentEntry[]>);
          const dayKeys = Object.keys(byDay).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));

          type WeekHeaderItem = { kind: 'weekHeader'; key: string };
          type DayItemW = { kind: 'day'; key: string; entries: MomentEntry[] };
          const out: GroupedSection[] = [];
          // Week sticky header section
          const isCurrentYearW = target.start.getFullYear() === new Date().getFullYear();
          const sameMonthW = format(target.start, 'MM') === format(target.end, 'MM');
          const weekHeaderTitle = sameMonthW
            ? `${format(target.start, 'MMMM d')}–${format(target.end, 'd')}${isCurrentYearW ? '' : `, ${format(target.start, 'yyyy')}`}`
            : `${format(target.start, 'MMMM d')} – ${format(target.end, 'MMMM d')}${isCurrentYearW ? '' : `, ${format(target.start, 'yyyy')}`}`;
          out.push({ title: weekHeaderTitle, data: [{ kind: 'weekHeader', key: target.key } as WeekHeaderItem] as any[], key: `weeksec-${target.key}` });
          // Day sections
          dayKeys.forEach(dk => {
            const entries = byDay[dk].sort((a, b) => (sortBy === 'oldest' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));
            const dayDate = entries[0]?.date ?? new Date(dk);
            const isCurrentYear = dayDate.getFullYear() === new Date().getFullYear();
            const dayTitle = isCurrentYear ? format(dayDate, 'EEEE, MMMM d') : format(dayDate, 'EEEE, MMMM d, yyyy');
            out.push({ title: dayTitle, data: [{ kind: 'day', key: dk, entries } as DayItemW] as any[], key: `daysecw-${dk}` });
          });
          return out;
        }
      }

      // Sort month sections by first week date
      return sections.sort((a, b) => {
        const aFirst = (a.data[0] as WeekItem | undefined)?.start || new Date(0);
        const bFirst = (b.data[0] as WeekItem | undefined)?.start || new Date(0);
        return sortBy === 'oldest' ? aFirst.getTime() - bFirst.getTime() : bFirst.getTime() - aFirst.getTime();
      });
    }

    // Special handling for month: default sticky header is YEAR; when a month is expanded,
    // split into Month section + per-Day sections so sticky header can change day-by-day.
    if (groupBy === 'month') {
      type YearMonths = Record<string, { start: Date; end: Date; key: string; entries: MomentEntry[]; title: string; days: Record<string, MomentEntry[]> }>; // per month metadata
      const byYear: Record<string, YearMonths> = {};

      sortedEntries.forEach((entry) => {
        const yearKey = format(entry.date, 'yyyy');
        const monthKey = format(startOfMonth(entry.date), 'yyyy-MM');
        if (!byYear[yearKey]) {byYear[yearKey] = {} as YearMonths;}
        if (!byYear[yearKey][monthKey]) {
          const start = startOfMonth(entry.date);
          const end = endOfMonth(entry.date);
          // Month card title (keeps current behavior: omits year when current year)
          const isCurrentYear = start.getFullYear() === new Date().getFullYear();
          const monthCardTitle = isCurrentYear ? format(start, 'MMMM') : format(start, 'MMMM yyyy');
          byYear[yearKey][monthKey] = { start, end, key: `${yearKey}::${monthKey}`, entries: [], title: monthCardTitle, days: {} };
        }
        const m = byYear[yearKey][monthKey];
        m.entries.push(entry);
        const dk = format(entry.date, 'yyyy-MM-dd');
        if (!m.days[dk]) {m.days[dk] = [];}
        m.days[dk].push(entry);
      });

      type DayItem = { kind: 'day'; key: string; entries: MomentEntry[] };
      type MonthHeaderItem = { kind: 'monthHeader'; key: string };
      const sections: GroupedSection[] = [];
      const years = Object.keys(byYear).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));
      years.forEach((yearKey) => {
        const months = Object.keys(byYear[yearKey]).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));
        const expandedSet = new Set<string>(months.filter((mk) => !!expandedMonths[`${yearKey}::${mk}`]));

        // If no month is expanded, show the Year section with all collapsed months.
        // If any month is expanded, hide the Year list entirely so only that month is visible.
        if (expandedSet.size === 0) {
          const collapsedMonthItems: MonthItem[] = months.map((mk) => {
            const m = byYear[yearKey][mk];
            return { key: m.key, start: m.start, end: m.end, title: m.title, entries: m.entries } as MonthItem;
          });
          if (collapsedMonthItems.length > 0) {
            sections.push({ title: yearKey, data: collapsedMonthItems, key: yearKey });
          }
        }

        // For each expanded month, emit a Month section and Day sections.
        months.forEach((mk) => {
          const m = byYear[yearKey][mk];
          const isExpanded = expandedSet.has(mk);
          if (!isExpanded) {return;}
          // Emit a month header section with a non-rendering placeholder item so only the sticky title shows
          const monthHeader: MonthHeaderItem = { kind: 'monthHeader', key: m.key };
          sections.push({ title: format(m.start, 'MMMM') + (m.start.getFullYear() === new Date().getFullYear() ? '' : ` ${format(m.start, 'yyyy')}`), data: [monthHeader as any], key: `monthsec-${mk}` });
          const dayKeys = Object.keys(m.days).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));
          dayKeys.forEach((dk) => {
            const dayEntries = m.days[dk].sort((a, b) => (sortBy === 'oldest' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));
            const dayItem: DayItem = { kind: 'day', key: dk, entries: dayEntries };
            const dayDate = dayEntries[0]?.date ?? new Date(dk);
            const isCurrentYear = dayDate.getFullYear() === new Date().getFullYear();
            const dayTitle = isCurrentYear ? format(dayDate, 'EEEE, MMMM d') : format(dayDate, 'EEEE, MMMM d, yyyy');
            sections.push({ title: dayTitle, data: [dayItem as any], key: `daysec-${dk}` });
          });
        });
      });

      return sections;
    }

    // Special handling for year: list of Year cards; when a year is expanded, show its months;
    // when a month is expanded, show Month header + per-Day sections.
    if (groupBy === 'year') {
      type YearMonths = Record<string, { start: Date; end: Date; key: string; entries: MomentEntry[]; title: string; days: Record<string, MomentEntry[]> }>; // per month metadata
      const byYear: Record<string, YearMonths> = {};

      // Build Year -> Month -> Day map
      sortedEntries.forEach((entry) => {
        const yearKey = format(entry.date, 'yyyy');
        const monthKey = format(startOfMonth(entry.date), 'yyyy-MM');
        if (!byYear[yearKey]) {byYear[yearKey] = {} as YearMonths;}
        if (!byYear[yearKey][monthKey]) {
          const start = startOfMonth(entry.date);
          const end = endOfMonth(entry.date);
          const isCurrentYear = start.getFullYear() === new Date().getFullYear();
          const monthCardTitle = isCurrentYear ? format(start, 'MMMM') : format(start, 'MMMM yyyy');
          byYear[yearKey][monthKey] = { start, end, key: `${yearKey}::${monthKey}`, entries: [], title: monthCardTitle, days: {} };
        }
        const m = byYear[yearKey][monthKey];
        m.entries.push(entry);
        const dk = format(entry.date, 'yyyy-MM-dd');
        if (!m.days[dk]) {m.days[dk] = [];}
        m.days[dk].push(entry);
      });

      type YearHeaderItem = { kind: 'yearHeader'; key: string };
      type YearItem = { kind: 'year'; key: string; year: string; counts: Record<string, number> };
      type DayItem = { kind: 'day'; key: string; entries: MomentEntry[] };

      const sections: GroupedSection[] = [];

      // Determine expanded year and month
      const expandedYearKeys = Object.keys(expandedYears).filter(k => !!expandedYears[k]);
      const expandedMonthKeys = Object.keys(expandedMonths).filter(k => !!expandedMonths[k]);

      const yearKeys = Object.keys(byYear).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));

      // If no year expanded, show a single section listing all Year cards with per-category counts
      if (expandedYearKeys.length === 0) {
        const yearItems: YearItem[] = yearKeys.map(yk => {
          const counts = Object.values(byYear[yk]).reduce((acc, m) => {
            m.entries.forEach(e => {
              const t = (e.category || '').toLowerCase();
              acc[t] = (acc[t] || 0) + 1;
            });
            return acc;
          }, {} as Record<string, number>);
          return { kind: 'year', key: yk, year: yk, counts } as YearItem;
        });
        if (yearItems.length > 0) {
          sections.push({ title: 'Years', data: yearItems as any[], key: 'years' });
        }
        return sections;
      }

      // A year is expanded
      const yearKey = expandedYearKeys[0];
      const months = Object.keys(byYear[yearKey]).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));

      // If no month is expanded within the expanded year, show Year header with list of MonthItem cards
      if (expandedMonthKeys.length === 0) {
        const header: YearHeaderItem = { kind: 'yearHeader', key: yearKey };
        const monthItems: MonthItem[] = months.map(mk => {
          const m = byYear[yearKey][mk];
          return { key: m.key, start: m.start, end: m.end, title: m.title, entries: m.entries } as MonthItem;
        });
        sections.push({ title: yearKey, data: [header as any, ...(monthItems as any[])], key: `yearsec-${yearKey}` });
        return sections;
      }

      // A month within the expanded year is expanded: emit Month header and Day sections
      const monthKey = expandedMonthKeys[0].split('::')[1];
      const m = byYear[yearKey][monthKey];
      if (m) {
        const monthHeader = { kind: 'monthHeader', key: m.key } as any;
        sections.push({ title: format(m.start, 'MMMM') + (m.start.getFullYear() === new Date().getFullYear() ? '' : ` ${format(m.start, 'yyyy')}`), data: [monthHeader], key: `monthsec-${monthKey}` });
        const dayKeys = Object.keys(m.days).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));
        dayKeys.forEach(dk => {
          const dayEntries = m.days[dk].sort((a, b) => (sortBy === 'oldest' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));
          const dayItem: DayItem = { kind: 'day', key: dk, entries: dayEntries };
          const dayDate = dayEntries[0]?.date ?? new Date(dk);
          const isCurrentYear = dayDate.getFullYear() === new Date().getFullYear();
          const dayTitle = isCurrentYear ? format(dayDate, 'EEEE, MMMM d') : format(dayDate, 'EEEE, MMMM d, yyyy');
          sections.push({ title: dayTitle, data: [dayItem as any], key: `daysecyr-${dk}` });
        });
        return sections;
      }

      return sections;
    }

    const groups: Record<string, MomentEntry[]> = {};

    sortedEntries.forEach((entry) => {
      let groupKey: string;

      switch (groupBy) {
        case 'date':
          groupKey = format(entry.date, 'yyyy-MM-dd');
          break;
        case 'category':
          groupKey = entry.category;
          break;
        case 'type':
          groupKey = entry.type;
          break;
        default:
          groupKey = 'default';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entry);
    });

    // Convert to sections array with carousel support
    const sections = Object.entries(groups).map(([key, entries]) => {
      let title = key;

      // For date grouping, create groups by type within each date
      if (groupBy === 'date') {
        // Collect ALL entries per type for the date
        const typeGroups: Record<string, MomentEntry[]> = {};

        entries.forEach((entry) => {
          // For Prayer Journal, group all ACTS/Open Prayer under a single card by plugin
          const typeKey = entry.plugin?.id === 'prayerjournal' ? 'Prayer Journal' : entry.type;
          if (!typeGroups[typeKey]) {typeGroups[typeKey] = [];}
          typeGroups[typeKey].push(entry);
        });

        // Build groups: devotional types keep all entries (carousel), non-devotional collapse to latest only
        const groupEntries: { type: string; items: MomentEntry[]; repr: MomentEntry }[] = Object.entries(typeGroups).map(([type, items]) => {
          const sorted = items.sort((a, b) => b.date.getTime() - a.date.getTime());
          const isDevotionalType = type.toLowerCase().includes('devotional');
          return {
            type,
            items: isDevotionalType ? sorted : [sorted[0]],
            repr: sorted[0],
          };
        });

        // Enforce ordering using the representative item for comparison
        const ordered = groupEntries.sort((a, b) => {
          const oa = getEntryRank(a.repr);
          const ob = getEntryRank(b.repr);
          if (oa !== ob) {return oa - ob;}
          // fallback by recency
          return b.repr.date.getTime() - a.repr.date.getTime();
        });

        // Finally, map into carouselData (each item is an array; devotional arrays can have multiple slides)
        const carouselData = ordered.map(group => group.items);

        // Get proper title for date grouping
        if (entries.length > 0) {
          const firstEntry = entries[0];
          const isCurrentYear = firstEntry.date.getFullYear() === new Date().getFullYear();
          title = format(firstEntry.date, isCurrentYear ? 'EEEE, MMMM d' : 'EEEE, MMMM d, yyyy');
        }

        return {
          title,
          data: carouselData,
          key,
        };
      }

      // Week grouping handled earlier (month sections)

      // For other grouping types, just wrap entries in array for consistency
      // Get proper title for the group
      if (entries.length > 0) {
        const firstEntry = entries[0];
        switch (groupBy) {
          case 'category':
            title = firstEntry.category.charAt(0).toUpperCase() + firstEntry.category.slice(1);
            break;
          case 'type':
            title = firstEntry.plugin.title;
            break;
        }
      }

      return {
        title,
        data: [entries],
        key,
      };
    });

    // Sort sections
    const sortedSections = sections.sort((a, b) => {
      if (groupBy === 'date') {
        const aFirstGroup = a.data[0] as MomentEntry[] | undefined;
        const bFirstGroup = b.data[0] as MomentEntry[] | undefined;
        const aDate = aFirstGroup && aFirstGroup.length > 0 ? aFirstGroup[0].date : new Date(0);
        const bDate = bFirstGroup && bFirstGroup.length > 0 ? bFirstGroup[0].date : new Date(0);
        return sortBy === 'oldest' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }
      // Alphabetical by title for category/type
      return a.title.localeCompare(b.title);
    });

    return sortedSections;
  }, [sortedEntries, groupBy, sortBy, expandedWeeks, expandedMonths, expandedYears, weekStartsOn]);

  // Only include sections with content
  const sectionsWithContent = useMemo(() => groupedSections.filter(s => (s.data?.length || 0) > 0), [groupedSections]);

  // Section header renderer (sticky headers with back chevrons for nested modes)
  const renderSectionHeader: any = ({ section }: any) => {
    // Flat date grouping: simple header
    if (groupBy === 'date') {
      return (
        <View style={styles.sectionHeader}>
          <ThemedText weight="semiBold" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>
        </View>
      );
    }

    // Month mode: show back chevron on Month and Day sticky headers
    if (
      groupBy === 'month' &&
      typeof section.key === 'string' &&
      (section.key.startsWith('monthsec-') || section.key.startsWith('daysec-') || section.key.startsWith('daysecyr-') || section.key.startsWith('yearsec-'))
    ) {
      const onPress = () => {
        triggerLightHaptic();
        let yearFromKey: string | null = null;
        if (section.key.startsWith('monthsec-')) {
          const mk = section.key.replace('monthsec-', '');
          yearFromKey = mk.slice(0, 4);
        } else if (section.key.startsWith('daysecyr-')) {
          const dk = section.key.replace('daysecyr-', '');
          yearFromKey = dk.slice(0, 4);
        } else if (section.key.startsWith('yearsec-') || /^\d{4}$/.test(String(section.title))) {
          // If on a plain year header inside month mode, collapse all the way out
          setExpandedMonths({});
          setExpandedYears({});
          return;
        }
        // Default: collapse months and, if available, re-expand the associated year
        setExpandedMonths({});
        if (yearFromKey) {setExpandedYears({ [yearFromKey]: true });}
      };
      const showChevron = section.key === currentStickyKey;
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
          <View style={styles.sectionHeader}>
            <ThemedText accessibilityLabel="Back to months" style={[styles.chevronIcon, showChevron ? styles.chevronVisible : styles.chevronHidden]}>‹</ThemedText>
            <ThemedText weight="semiBold" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          </View>
        </TouchableOpacity>
      );
    }
    // In week mode, when a week is expanded, we emit sticky Week and Day headers. Mirror chevron/behavior.
    if (groupBy === 'week' && typeof section.key === 'string' && (section.key.startsWith('weeksec-') || section.key.startsWith('daysecw-'))) {
      const onPress = () => {
        triggerLightHaptic();
        setExpandedWeeks({});
      };
      const showChevron = section.key === currentStickyKey;
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
          <View style={styles.sectionHeader}>
            <ThemedText accessibilityLabel="Back to weeks" style={[styles.chevronIcon, showChevron ? styles.chevronVisible : styles.chevronHidden]}>‹</ThemedText>
            <ThemedText weight="semiBold" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.sectionHeader}>
        <ThemedText weight="semiBold" style={styles.sectionTitle}>
          {section.title}
        </ThemedText>
        {groupBy !== 'week' && groupBy !== 'month' && groupBy !== 'year' && (
          <ThemedText style={styles.sectionCount}>
            {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
          </ThemedText>
        )}
      </View>
    );
  };

  // Track currently sticky header: we update from viewable items callback below
  const [currentStickyKey, setCurrentStickyKey] = useState<string | null>(null);

  // Reset expansion state and sticky key when grouping changes so we return to the initial page
  useEffect(() => {
    setCurrentStickyKey(null);
    switch (groupBy) {
      case 'month':
        setExpandedWeeks({});
        setExpandedYears({});
        // do not auto-expand any month
        setExpandedMonths({});
        break;
      case 'week':
        setExpandedMonths({});
        setExpandedYears({});
        setExpandedWeeks({});
        break;
      case 'year':
        setExpandedWeeks({});
        // keep months collapsed on entry to year view
        setExpandedMonths({});
        setExpandedYears({});
        break;
      default:
        setExpandedWeeks({});
        setExpandedMonths({});
        setExpandedYears({});
        break;
    }
  }, [groupBy]);

  const renderCarouselItem: any = ({ item, index, _section }: any) => {
    if (groupBy === 'week') {
      // Support custom emitted kinds when a week is expanded
      const maybeKind: any = item as any;
      if (maybeKind && maybeKind.kind === 'weekHeader') {
        // Header is provided by sticky section title; nothing to render for item
        return null;
      }
      if (maybeKind && maybeKind.kind === 'day') {
        const dayItem = maybeKind as { kind: 'day'; key: string; entries: MomentEntry[] };
        const dayEntries = dayItem.entries;
        // De-duplicate Prayer Journal within the day (keep the most recent by date)
        let newestPrayerIdx = -1;
        let newestPrayerTime = -1;
        dayEntries.forEach((e, i) => {
          const pid = (e as any)?.plugin?.id || '';
          if (pid === 'prayerjournal') {
            const t = e.date?.getTime?.() ?? new Date(e.date as any).getTime();
            if (t > newestPrayerTime) {
              newestPrayerTime = t;
              newestPrayerIdx = i;
            }
          }
        });
        const filteredEntries = dayEntries.filter((e, i) => {
          const pid = (e as any)?.plugin?.id || '';
          if (pid === 'prayerjournal') {
            return i === newestPrayerIdx;
          }
          return true;
        });
        const ordered = filteredEntries.slice().sort((a, b) => {
          const ra = getEntryRank(a);
          const rb = getEntryRank(b);
          if (ra !== rb) {return ra - rb;}
          return (b.date?.getTime?.() ?? new Date(b.date as any).getTime()) - (a.date?.getTime?.() ?? new Date(a.date as any).getTime());
        });
        return (
          <View style={styles.weekExpandedBody}>
            {ordered.map((entry, i) => (
              <View key={`wday-${dayItem.key}-entry-${i}`} style={styles.carouselItem}>
                <View style={styles.momentItem}>
                  <View style={styles.momentContent}>
                    <PluginRenderer plugin={entry.plugin} selectedDate={entry.date} refreshKey={refreshKey} viewMode="inline" filters={pluginFilters} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        );
      }
      const week = item as WeekItem;
      if (!week) {return null;}
      const weekNumber = getWeek(week.start, { weekStartsOn, firstWeekContainsDate: 4 });
      const isExpanded = !!expandedWeeks[week.key];
      const toggle = () => {
        triggerLightHaptic();
        return setExpandedWeeks(prev => {
          if (prev[week.key]) {return {};}
          return { [week.key]: true } as Record<string, boolean>;
        });
      };

      const counts = week.entries.reduce((acc, e) => {
        const t = (e.category || '').toLowerCase();
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byDay = week.entries.reduce((acc, e) => {
        const k = format(e.date, 'yyyy-MM-dd');
        if (!acc[k]) {acc[k] = [] as typeof week.entries;}
        acc[k].push(e);
        return acc;
      }, {} as Record<string, MomentEntry[]>);
      const dayKeys = Object.keys(byDay).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));

      // Build display range title (omit year if current year)
      const isCurrentYear = week.start.getFullYear() === new Date().getFullYear();
      const sameMonth = format(week.start, 'MM') === format(week.end, 'MM');
      const displayRangeTitle = sameMonth
        ? `${format(week.start, 'MMMM d')}–${format(week.end, 'd')}${isCurrentYear ? '' : `, ${format(week.start, 'yyyy')}`}`
        : `${format(week.start, 'MMMM d')} – ${format(week.end, 'MMMM d')}${isCurrentYear ? '' : `, ${format(week.start, 'yyyy')}`}`;

      return (
        <View style={[styles.weekCardContainer, styles.transparentBackground]} >
          <TouchableOpacity onPress={toggle} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <View style={[styles.weekCardHeader, styles.transparentBackground, styles.columnLayout]} >
              <ThemedText style={styles.weekRangeTitle}>
                {`Week ${weekNumber}`}
              </ThemedText>
              <ThemedText weight="semiBold" style={[styles.sectionTitle, styles.weekTitleSpacing]}>
                {displayRangeTitle}
              </ThemedText>
              {Object.keys(counts).length > 0 && (
                <ThemedText style={[styles.weekCountsText, styles.countsSpacing]}>
                  {Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(' · ')}
                </ThemedText>
              )}
            </View>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.weekExpandedBody}>
              {dayKeys.map((dk) => {
                const dayEntries = byDay[dk].sort((a, b) => (sortBy === 'oldest' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));
                const dayDate = dayEntries[0].date;
                return (
                  <View key={`${week.key}-day-${dk}`}>
                    <View style={styles.dayHeaderRow}>
                      <ThemedText weight="semiBold" style={styles.dayHeaderText}>
                        {format(dayDate, 'EEEE, MMMM d')}
                      </ThemedText>
                    </View>
                    {(() => {
                      // De-duplicate Prayer Journal within the day (keep the most recent by date)
                      let newestPrayerIdx = -1;
                      let newestPrayerTime = -1;
                      dayEntries.forEach((e, i) => {
                        const pid = (e as any)?.plugin?.id || '';
                        if (pid === 'prayerjournal') {
                          const t = e.date?.getTime?.() ?? new Date(e.date as any).getTime();
                          if (t > newestPrayerTime) {
                            newestPrayerTime = t;
                            newestPrayerIdx = i;
                          }
                        }
                      });

                      const filteredEntries = dayEntries.filter((e, i) => {
                        const pid = (e as any)?.plugin?.id || '';
                        if (pid === 'prayerjournal') {
                          return i === newestPrayerIdx;
                        }
                        return true;
                      });
                      const ordered = filteredEntries.slice().sort((a, b) => {
                        const ra = getEntryRank(a);
                        const rb = getEntryRank(b);
                        if (ra !== rb) {return ra - rb;}
                        return (b.date?.getTime?.() ?? new Date(b.date as any).getTime()) - (a.date?.getTime?.() ?? new Date(a.date as any).getTime());
                      });

                      return ordered.map((entry, i) => (
                        <View key={`${week.key}-entry-${dk}-${i}`} style={styles.carouselItem}>
                          <View style={styles.momentItem}>
                            <View style={styles.momentContent}>
                              <PluginRenderer
                                plugin={entry.plugin}
                                selectedDate={entry.date}
                                refreshKey={refreshKey}
                                viewMode="inline"
                                filters={pluginFilters}
                              />
                            </View>
                          </View>
                        </View>
                      ));
                    })()}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    // Month-specific rendering: MonthItem cards and DayItem bodies
    if (groupBy === 'month') {
      const month = item as MonthItem;
      // DayItem branch
      const maybeDay: any = item as any;
      if (maybeDay && maybeDay.kind === 'monthHeader') {
        // Do not render a month card here; the sticky section header already shows the month title
        return null;
      }
      if (maybeDay && maybeDay.kind === 'day') {
        const dayItem = maybeDay as { kind: 'day'; key: string; entries: MomentEntry[] };
        // Render entries for this day (header is provided by sticky section title)
        const dayEntries = dayItem.entries;
        // De-duplicate Prayer Journal within the day (keep the most recent by date)
        let newestPrayerIdx = -1;
        let newestPrayerTime = -1;
        dayEntries.forEach((e, i) => {
          const pid = (e as any)?.plugin?.id || '';
          if (pid === 'prayerjournal') {
            const t = e.date?.getTime?.() ?? new Date(e.date as any).getTime();
            if (t > newestPrayerTime) {
              newestPrayerTime = t;
              newestPrayerIdx = i;
            }
          }
        });
        const filteredEntries = dayEntries.filter((e, i) => {
          const pid = (e as any)?.plugin?.id || '';
          if (pid === 'prayerjournal') {
            return i === newestPrayerIdx;
          }
          return true;
        });
        const ordered = filteredEntries.slice().sort((a, b) => {
          const ra = getEntryRank(a);
          const rb = getEntryRank(b);
          if (ra !== rb) {return ra - rb;}
          return (b.date?.getTime?.() ?? new Date(b.date as any).getTime()) - (a.date?.getTime?.() ?? new Date(a.date as any).getTime());
        });
        return (
          <View style={styles.weekExpandedBody}>
            {ordered.map((entry, i) => (
              <View key={`day-${dayItem.key}-entry-${i}`} style={styles.carouselItem}>
                <View style={styles.momentItem}>
                  <View style={styles.momentContent}>
                    <PluginRenderer plugin={entry.plugin} selectedDate={entry.date} refreshKey={refreshKey} viewMode="inline" filters={pluginFilters} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        );
      }
      if (!month) {return null;}
      const isExpanded = !!expandedMonths[month.key];
      const toggle = () => {
        triggerLightHaptic();
        return setExpandedMonths(prev => {
          // Exclusive expansion: if tapping the already-expanded month, collapse all; otherwise expand only this one
          if (prev[month.key]) {return {};}
          return { [month.key]: true } as Record<string, boolean>;
        });
      };

      // Counts by category
      const counts = month.entries.reduce((acc, e) => {
        const t = (e.category || '').toLowerCase();
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Group by day
      const byDay = month.entries.reduce((acc, e) => {
        const k = format(e.date, 'yyyy-MM-dd');
        if (!acc[k]) {acc[k] = [] as typeof month.entries;}
        acc[k].push(e);
        return acc;
      }, {} as Record<string, MomentEntry[]>);
      const dayKeys = Object.keys(byDay).sort((a, b) => (sortBy === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)));

      return (
        <View style={[styles.weekCardContainer, styles.transparentBackground]}>
          <TouchableOpacity onPress={toggle} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <View style={[styles.weekCardHeader, styles.transparentBackground, styles.columnLayout]}>
              <ThemedText weight="semiBold" style={styles.sectionTitle}>
                {month.title}
              </ThemedText>
              {Object.keys(counts).length > 0 && (
                <ThemedText style={[styles.weekCountsText, styles.countsSpacing]}>
                  {Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(' · ')}
                </ThemedText>
              )}
            </View>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.weekExpandedBody}>
              {dayKeys.map((dk) => {
                const dayEntries = byDay[dk].sort((a, b) => (sortBy === 'oldest' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));
                const dayDate = dayEntries[0].date;
                return (
                  <View key={`${month.key}-day-${dk}`}>
                    <View style={styles.dayHeaderRow}>
                      <ThemedText weight="semiBold" style={styles.dayHeaderText}>
                        {format(dayDate, 'EEEE, MMMM d')}
                      </ThemedText>
                    </View>
                    {(() => {
                      // De-duplicate Prayer Journal and apply global ordering for month day entries
                      let newestPrayerIdx = -1;
                      let newestPrayerTime = -1;
                      dayEntries.forEach((e, i) => {
                        const pid = (e as any)?.plugin?.id || '';
                        if (pid === 'prayerjournal') {
                          const t = e.date?.getTime?.() ?? new Date(e.date as any).getTime();
                          if (t > newestPrayerTime) { newestPrayerTime = t; newestPrayerIdx = i; }
                        }
                      });
                      const filtered = dayEntries.filter((e, i) => {
                        const pid = (e as any)?.plugin?.id || '';
                        if (pid === 'prayerjournal') {return i === newestPrayerIdx;}
                        return true;
                      });
                      const ordered = filtered.slice().sort((a, b) => {
                        const ra = getEntryRank(a);
                        const rb = getEntryRank(b);
                        if (ra !== rb) {return ra - rb;}
                        return (b.date?.getTime?.() ?? new Date(b.date as any).getTime()) - (a.date?.getTime?.() ?? new Date(a.date as any).getTime());
                      });
                      return ordered.map((entry, i) => (
                      <View key={`${month.key}-entry-${dk}-${i}`} style={styles.carouselItem}>
                        <View style={styles.momentItem}>
                          <View style={styles.momentContent}>
                            <PluginRenderer plugin={entry.plugin} selectedDate={entry.date} refreshKey={refreshKey} viewMode="inline" filters={pluginFilters} />
                          </View>
                        </View>
                      </View>
                      ));
                    })()}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    // Year-specific rendering: handle Year cards, Month cards inside expanded year, and Day bodies
    if (groupBy === 'year') {
      const anyItem = item as any;
      if (anyItem && anyItem.kind === 'yearHeader') {
        // Sticky header renders the title; no item body
        return null;
      }
      if (anyItem && anyItem.kind === 'day') {
        const dayItem = anyItem as { kind: 'day'; key: string; entries: MomentEntry[] };
        const dayEntries = dayItem.entries;
        // De-duplicate Prayer Journal within the day (keep most recent)
        let newestPrayerIdx = -1;
        let newestPrayerTime = -1;
        dayEntries.forEach((e, i) => {
          const pid = (e as any)?.plugin?.id || '';
          if (pid === 'prayerjournal') {
            const t = e.date?.getTime?.() ?? new Date(e.date as any).getTime();
            if (t > newestPrayerTime) { newestPrayerTime = t; newestPrayerIdx = i; }
          }
        });
        const filteredEntries = dayEntries.filter((e, i) => {
          const pid = (e as any)?.plugin?.id || '';
          if (pid === 'prayerjournal') {return i === newestPrayerIdx;}
          return true;
        });
        const ordered = filteredEntries.slice().sort((a, b) => {
          const ra = getEntryRank(a);
          const rb = getEntryRank(b);
          if (ra !== rb) {return ra - rb;}
          return (b.date?.getTime?.() ?? new Date(b.date as any).getTime()) - (a.date?.getTime?.() ?? new Date(a.date as any).getTime());
        });
        return (
          <View style={styles.weekExpandedBody}>
            {ordered.map((entry, i) => (
              <View key={`yrday-${dayItem.key}-entry-${i}`} style={styles.carouselItem}>
                <View style={styles.momentItem}>
                  <View style={styles.momentContent}>
                    <PluginRenderer plugin={entry.plugin} selectedDate={entry.date} refreshKey={refreshKey} viewMode="inline" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        );
      }

      // Month card within expanded year
      if (anyItem && anyItem.start && anyItem.end && anyItem.title && anyItem.key) {
        const month = anyItem as MonthItem;
        const toggle = () => {
          triggerLightHaptic();
          return setExpandedMonths(prev => (prev[month.key] ? {} : ({ [month.key]: true } as Record<string, boolean>)));
        };

        const counts = month.entries.reduce((acc, e) => {
          const t = (e.category || '').toLowerCase();
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (
          <View style={[styles.weekCardContainer, styles.transparentBackground]} >
            <TouchableOpacity onPress={toggle} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
              <View style={[styles.weekCardHeader, styles.transparentBackground, styles.columnLayout]} >
                <ThemedText weight="semiBold" style={styles.sectionTitle}>
                  {month.title}
                </ThemedText>
                {Object.keys(counts).length > 0 && (
                  <ThemedText style={[styles.weekCountsText, styles.countsSpacing]}>
                    {Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(' · ')}
                  </ThemedText>
                )}
              </View>
            </TouchableOpacity>
          </View>
        );
      }

      // Year card
      if (anyItem && anyItem.kind === 'year') {
        const year = anyItem.year as string;
        const counts: Record<string, number> = (anyItem.counts as Record<string, number>) || {};
        const toggleYear = () => {
          triggerLightHaptic();
          // Clear month expansions to avoid stale keys from other modes/years
          setExpandedMonths({});
          setExpandedYears({ [year]: true });
        };
        return (
          <View style={[styles.weekCardContainer, styles.transparentBackground]} >
            <TouchableOpacity onPress={toggleYear} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
              <View style={[styles.weekCardHeader, styles.transparentBackground, styles.columnLayout]} >
                <ThemedText weight="semiBold" style={styles.sectionTitle}>
                  {year}
                </ThemedText>
                {Object.keys(counts).length > 0 && (
                  <ThemedText style={[styles.weekCountsText, styles.countsSpacing]}>
                    {Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(' · ')}
                  </ThemedText>
                )}
              </View>
            </TouchableOpacity>
          </View>
        );
      }

      return null;
    }

    const carouselGroup = item as MomentEntry[];
    return (
      <View style={styles.carouselItem}>
        {carouselGroup && carouselGroup.map((entry, i) => (
          <View key={`entry-${index}-${i}`} style={styles.momentItem}>
            <View style={styles.momentContent}>
              <PluginRenderer
                plugin={entry.plugin}
                selectedDate={entry.date}
                refreshKey={refreshKey}
                viewMode="inline"
                filters={pluginFilters}
              />
            </View>
          </View>
        ))}
      </View>
    );
  };
  // (moved sectionsWithContent useMemo above)

  // Ensure scroll resets when structure changes (e.g., expand/collapse year/month/week or switch views/filters)
  const sectionListRef = useRef<SectionList<any>>(null);
  const listKey = useMemo(
    () => [groupBy, ...sectionsWithContent.map((s: any) => s?.key || '')].join('|'),
    [groupBy, sectionsWithContent]
  );
  useEffect(() => {
    // On any structural change, jump to top to avoid "header stuck at bottom" issue on back
    requestAnimationFrame(() => {
      try {
        const hasSections = Array.isArray(sectionsWithContent) && sectionsWithContent.length > 0;
        const firstHasItems = hasSections && Array.isArray(sectionsWithContent[0]?.data) && sectionsWithContent[0].data.length > 0;
        if (firstHasItems) {
          sectionListRef.current?.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false });
        } else {
          // Safely scroll to top without targeting a non-existent item
          (sectionListRef.current as any)?.getScrollResponder?.()?.scrollTo?.({ y: 0, animated: false });
        }
      } catch (e) {
        // Last resort: ensure list is at top
        (sectionListRef.current as any)?.getScrollResponder?.()?.scrollTo?.({ y: 0, animated: false });
      }
    });
  }, [listKey, sectionsWithContent]);

  // Context-aware empty subtitle
  const emptySubtitleText = useMemo(() => {
    const parts: string[] = [];
    if (searchQuery?.trim()) {parts.push(`matching “${searchQuery.trim()}”`);}
    const active: string[] = [];
    if (filterKeys?.includes('answeredPrayers')) {active.push('answered prayers');}
    if (filterKeys?.includes('unansweredPrayers')) {active.push('unanswered prayers');}
    if (filterKeys?.includes('reflectionJournals')) {active.push('reflections');}
    if (filterKeys?.includes('prayers')) {active.push('prayers');}
    if (filterKeys?.includes('prayerRequests')) {active.push('prayer requests');}
    if (filterKeys?.includes('gratitude')) {active.push('gratitude');}
    if (filterKeys?.includes('todaysWin')) {active.push("today's win");}
    if (filterKeys?.includes('planCarousel')) {active.push('plans');}
    if (active.length) {parts.push(`in ${active.join(', ')}`);}
    if (dateRange?.label) {parts.push(`for ${dateRange.label.toLowerCase()}`);}
    const suffix = parts.length ? ` ${parts.join(' ')}` : '';
    return `You don't have any moments${suffix}.`;
  }, [searchQuery, filterKeys, dateRange?.label]);

  const ListEmpty = useMemo(() => (
    <View style={styles.emptyState} accessibilityRole="summary">
      <Feather size={32} color={Colors.textGray} style={styles.emptyIcon} />
      <ThemedText weight="semiBold" style={styles.emptyTitle}>No Moments Yet</ThemedText>
      <ThemedText style={styles.emptySubtitle}>{emptySubtitleText}</ThemedText>
      {!!onAddPress && (
        <TouchableOpacity
          onPress={() => { triggerLightHaptic(); onAddPress?.(); }}
          style={styles.emptyButton}
          accessibilityRole="button"
          accessibilityLabel="Add a new moment"
        >
          <ThemedText weight="medium" style={styles.emptyButtonText}>Add a moment</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  ), [emptySubtitleText, onAddPress, styles.emptyButton, styles.emptyButtonText, styles.emptyIcon, styles.emptyState, styles.emptySubtitle, styles.emptyTitle]);

  // Show skeleton during loading instead of empty state
  if (_loading) {
    return (
      <View style={[styles.container, style]}>
        <MomentsSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <SectionList
        ref={sectionListRef}
        key={listKey}
        sections={sectionsWithContent}
        renderItem={renderCarouselItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        scrollIndicatorInsets={{ top: 0, bottom: 0, left: 0, right: 0 }}
        ListEmptyComponent={ListEmpty}
        onViewableItemsChanged={({ viewableItems }) => {
          // Pick the first visible header's section key, else fall back to first visible item's section key
          const header = viewableItems.find(v => !v.item && v.section && typeof (v.section as any).key === 'string');
          if (header && (header.section as any).key) {
            setCurrentStickyKey((header.section as any).key as string);
          } else if (viewableItems[0]?.section && (viewableItems[0].section as any).key) {
            setCurrentStickyKey((viewableItems[0].section as any).key as string);
          }
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
        keyExtractor={(item, index) => {
          if (groupBy === 'week') {
            const anyItem = item as any;
            if (anyItem && anyItem.kind === 'day') {
              return `wday-${anyItem.key || index}`;
            }
            if (anyItem && anyItem.kind === 'weekHeader') {
              return `weekhdr-${anyItem.key || index}`;
            }
            const w = item as WeekItem;
            return `week-${w?.key || index}`;
          }
          if (groupBy === 'month') {
            const anyItem = item as any;
            if (anyItem && anyItem.kind === 'day') {
              return `day-${anyItem.key || index}`;
            }
            if (anyItem && anyItem.kind === 'monthHeader') {
              return `monthhdr-${anyItem.key || index}`;
            }
            const m = item as MonthItem;
            return `month-${m?.key || index}`;
          }
          if (groupBy === 'year') {
            const anyItem = item as any;
            if (anyItem && anyItem.kind === 'day') {
              return `yrday-${anyItem.key || index}`;
            }
            if (anyItem && anyItem.kind === 'monthHeader') {
              return `yr-monthhdr-${anyItem.key || index}`;
            }
            if (anyItem && anyItem.kind === 'yearHeader') {
              return `yr-hdr-${anyItem.key || index}`;
            }
            if (anyItem && anyItem.kind === 'year') {
              return `year-${anyItem.year || index}`;
            }
            const m = item as MonthItem;
            return `yr-month-${m?.key || index}`;
          }
          const arr = item as MomentEntry[];
          return `carousel-${index}-${arr.length > 0 ? arr[0].plugin.id : 'empty'}`;
        }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={
          headerComponents.length > 0 ? (
            <View>
              {headerComponents.map((component, index) => (
                <View key={index}>{component}</View>
              ))}
            </View>
          ) : undefined
        }
        refreshControl={refreshControl}
      />
    </View>
  );
};

export default EnhancedMomentsRenderer;
