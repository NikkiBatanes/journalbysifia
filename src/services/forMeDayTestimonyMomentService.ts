import {
  createLocalReflection,
  getAllLocalReflectionsByType,
  updateLocalReflection,
  type LocalReflectionEntry,
} from '../storage/reflectionStorage';
import type {ForMeDaySettings} from '../storage/gospelStorage';
import {toLocalDateString} from '../utils/date';
import {emitMomentsStructuralRefresh} from '../utils/momentsRefresh';

const TESTIMONY_TYPE = 'gospel_anniversary';
const TESTIMONY_SOURCE = 'for_me_day';
const TESTIMONY_ENTRY = 'testimony';

type TestimonySettings = Pick<
  ForMeDaySettings,
  | 'originalStory'
  | 'spiritualBirthday'
  | 'testimonyWrittenAt'
  | 'testimonyUpdatedAt'
>;

const isTestimonyMoment = (entry: LocalReflectionEntry): boolean =>
  !entry.deleted &&
  entry.source === TESTIMONY_SOURCE &&
  entry.metadata?.forMeDayEntry === TESTIMONY_ENTRY;

export const syncForMeDayTestimonyMoment = async (
  settings: TestimonySettings,
): Promise<LocalReflectionEntry | null> => {
  const testimony = settings.originalStory?.trim() || '';
  if (!testimony) {return null;}

  const writtenAt = settings.testimonyWrittenAt || new Date().toISOString();
  const writtenDate = new Date(writtenAt);
  const selectedDate = toLocalDateString(
    Number.isFinite(writtenDate.getTime()) ? writtenDate : new Date(),
  );
  const entries = await getAllLocalReflectionsByType(TESTIMONY_TYPE);
  const existing = entries
    .filter(isTestimonyMoment)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const metadata = {
    ...(existing?.metadata || {}),
    journalClassification: 'milestone',
    forMeDayEntry: TESTIMONY_ENTRY,
    testimonyWrittenAt: writtenAt,
    testimonyUpdatedAt: settings.testimonyUpdatedAt,
    spiritualBirthday: settings.spiritualBirthday,
  };

  let moment: LocalReflectionEntry;
  if (existing) {
    const needsUpdate =
      existing.title !== 'My testimony' ||
      existing.content !== testimony ||
      existing.metadata?.testimonyWrittenAt !== writtenAt ||
      existing.metadata?.testimonyUpdatedAt !== settings.testimonyUpdatedAt ||
      existing.metadata?.spiritualBirthday !== settings.spiritualBirthday;
    moment = needsUpdate
      ? await updateLocalReflection({
          ...existing,
          title: 'My testimony',
          content: testimony,
          metadata,
        })
      : existing;
  } else {
    moment = await createLocalReflection({
      title: 'My testimony',
      content: testimony,
      type: TESTIMONY_TYPE,
      source: TESTIMONY_SOURCE,
      selected_date: selectedDate,
      metadata,
    });
  }

  if (!existing || moment !== existing) {
    emitMomentsStructuralRefresh(TESTIMONY_TYPE, moment.selected_date, [moment.id]);
  }
  return moment;
};
