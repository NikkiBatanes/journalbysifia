import { JournalPlugin } from '../types';

// Import existing components (preserving all current functionality)
import { TodaysFocusReactQuery } from '../../../components/journal/TodaysFocusReactQuery';
import { TodosReactQuery } from '../../../components/journal/TodosReactQuery';
import { TimeBlockReactQuery } from '../../../components/journal/TimeBlockReactQuery';
import { ReflectionLogReactQuery } from '../../../components/journal/ReflectionLogReactQuery';
import { GratitudeListReactQuery } from '../../../components/journal/GratitudeListReactQuery';
import { TodayWinReactQuery } from '../../../components/journal/TodayWinReactQuery';
import { LookingForwardReactQuery } from '../../../components/journal/LookingForwardReactQuery';
import { PrayerJournalReactQuery } from '../../../components/journal/PrayerJournalReactQuery';
import EnhancedPrayerListReactQuery from '../../../components/journal/EnhancedPrayerListReactQuery';

// Plugin Registry - Auto-discovery system
export const JOURNAL_PLUGINS: JournalPlugin[] = [
  // PLAN Category
  {
    id: 'focus',
    category: 'plan',
    component: TodaysFocusReactQuery,
    priority: 1,
    viewModes: ['carousel', 'inline', 'moments'],
    title: "Today's Focus",
    subtitle: 'Your daily focus and priorities',
  },
  {
    id: 'todos',
    category: 'plan',
    component: TodosReactQuery,
    priority: 2,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Todos',
    subtitle: 'Track your daily tasks',
  },
  {
    id: 'timeblocks',
    category: 'plan',
    component: TimeBlockReactQuery,
    priority: 3,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Time Blocks',
    subtitle: 'Schedule your day',
  },

  // REFLECT Category
  {
    id: 'reflection',
    category: 'reflect',
    component: ReflectionLogReactQuery,
    priority: 1,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Reflection',
    subtitle: 'Daily reflections and thoughts',
  },
  {
    id: 'gratitude',
    category: 'reflect',
    component: GratitudeListReactQuery,
    priority: 2,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Gratitude',
    subtitle: 'What are you grateful for?',
  },
  {
    id: 'todayswin',
    category: 'reflect',
    component: TodayWinReactQuery,
    priority: 3,
    viewModes: ['carousel', 'inline', 'moments'],
    title: "Today's Win",
    subtitle: 'Celebrate your achievements',
  },
  {
    id: 'lookingforward',
    category: 'reflect',
    component: LookingForwardReactQuery,
    priority: 4,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Looking Forward',
    subtitle: "Tomorrow's aspirations",
  },

  // PRAY Category
  {
    id: 'prayerjournal',
    category: 'pray',
    component: PrayerJournalReactQuery,
    priority: 1,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Prayer Journal',
    subtitle: 'ACTS & Open Prayer',
  },
  {
    id: 'peopleprayers',
    category: 'pray',
    component: EnhancedPrayerListReactQuery,
    priority: 3,
    viewModes: ['carousel', 'inline', 'moments'],
    title: 'Prayer List',
    subtitle: 'Prayers for people',
  },
];

// Plugin Discovery Functions
export const getPluginsByCategory = (category: string) =>
  JOURNAL_PLUGINS.filter(plugin => plugin.category === category)
    .sort((a, b) => a.priority - b.priority);

export const getPluginsByViewMode = (viewMode: string) =>
  JOURNAL_PLUGINS.filter(plugin => plugin.viewModes.includes(viewMode as any));

export const getPluginById = (id: string) =>
  JOURNAL_PLUGINS.find(plugin => plugin.id === id);

export const getAllPlugins = () => JOURNAL_PLUGINS;
