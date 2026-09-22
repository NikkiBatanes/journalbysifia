import type {FilterKey} from '../components/moments/momentFilterOptions';
import type {MomentTimelineItem, MomentTimelineKind, RoutineSectionKind} from './momentTimelineService';

export interface FilterableMoment {
  kind?: MomentTimelineKind;
  pluginId?: string;
  sectionKinds?: RoutineSectionKind[];
  isPrayer?: boolean;
  isPrayerRequest?: boolean;
  isReflection?: boolean;
  isGratitude?: boolean;
  isWin?: boolean;
  isPlan?: boolean;
}

const pluginIs = (moment: FilterableMoment, ...ids: string[]): boolean =>
  ids.includes((moment.pluginId || '').toLowerCase());

const hasSection = (moment: FilterableMoment, section: RoutineSectionKind): boolean =>
  moment.sectionKinds?.includes(section) === true;

const ROUTINE_SECTIONS_BY_FILTER: Partial<Record<FilterKey, RoutineSectionKind[]>> = {
  morningCheckIns: ['check_in'],
  morningPsalms: ['psalm'],
  todaysFocus: ['focus'],
  todos: ['priorities'],
  gratitude: ['gratitude'],
  todaysWin: ['win'],
  eveningProverbs: ['proverbs'],
  lookingForward: ['looking_forward'],
  planCarousel: ['focus', 'priorities'],
};

export const getRoutineSectionKindsForFilters = (filters: FilterKey[]): RoutineSectionKind[] =>
  [...new Set(filters.flatMap(filter => ROUTINE_SECTIONS_BY_FILTER[filter] || []))];

/** Restricts a matched Morning/Evening card to the sections explicitly selected. */
export const narrowRoutineMomentToFilters = (
  item: MomentTimelineItem,
  filters: FilterKey[],
): MomentTimelineItem => {
  if (item.kind !== 'morning' && item.kind !== 'evening') {return item;}
  const selectedKinds = getRoutineSectionKindsForFilters(filters);
  if (!selectedKinds.length || !item.preview.sections?.length) {return item;}
  const sections = item.preview.sections.filter(section => selectedKinds.includes(section.kind));
  if (!sections.length || sections.length === item.preview.sections.length) {return item;}
  const lines = sections.flatMap(section => section.lines);
  const canonicalIds = [...new Set(sections.flatMap(section => section.canonicalIds))];
  return {
    ...item,
    canonicalIds,
    searchText: `${item.preview.title} ${lines.join(' ')}`.replace(/\s+/g, ' ').trim().toLowerCase(),
    preview: {...item.preview, lines, sections},
    metadata: {...item.metadata, sectionKinds: sections.map(section => section.kind)},
  };
};

/** Matches one category pill. Multiple selected pills are combined with OR. */
export const matchesMomentCategoryFilter = (
  moment: FilterableMoment,
  filter: FilterKey,
): boolean => {
  switch (filter) {
    case 'morningCheckIns':
      return hasSection(moment, 'check_in') || pluginIs(moment, 'morningcheckin');
    case 'morningPsalms':
      return hasSection(moment, 'psalm') || pluginIs(moment, 'morningpsalm');
    case 'todaysFocus':
      return hasSection(moment, 'focus') || pluginIs(moment, 'focus', 'todaysfocus');
    case 'todos':
      return hasSection(moment, 'priorities') || pluginIs(moment, 'todo', 'todos');
    case 'gratitude':
      return moment.isGratitude === true || hasSection(moment, 'gratitude') || pluginIs(moment, 'gratitude', 'eveninggratitude');
    case 'todaysWin':
      return moment.isWin === true || hasSection(moment, 'win') || pluginIs(moment, 'win', 'todayswin', 'eveningwin');
    case 'eveningProverbs':
      return hasSection(moment, 'proverbs') || pluginIs(moment, 'eveningproverb');
    case 'lookingForward':
      return hasSection(moment, 'looking_forward') || pluginIs(moment, 'lookingforward', 'lookingforwardto');
    case 'reflectionJournals':
      return moment.kind === 'reflection' || moment.isReflection === true || pluginIs(moment, 'reflection');
    case 'bibleStudy':
      return moment.kind === 'bible_study' || pluginIs(moment, 'biblestudy');
    case 'scriptureNotes':
      return moment.kind === 'scripture_note' || pluginIs(moment, 'scripturenote');
    case 'sessionNotes':
      return moment.kind === 'sermon' || pluginIs(moment, 'sermon');
    case 'prayers':
      return moment.isPrayer === true || moment.kind === 'prayer';
    case 'prayerRequests':
      return moment.isPrayerRequest === true;
    case 'planCarousel':
      return moment.isPlan === true || hasSection(moment, 'focus') || hasSection(moment, 'priorities');
    case 'upcoming':
    case 'answeredPrayers':
    case 'unansweredPrayers':
      return false;
  }
};
