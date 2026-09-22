import {differenceInCalendarDays, startOfDay} from 'date-fns';

import {fromLocalDateString} from '../utils/date';
import {psalmReflections} from '../data/psalmReflections';

type DateValue = string | Date | null | undefined;

export const DAILY_SCRIPTURE_SEQUENCE_OVERRIDE_KEY = 'dev-review-v2:scripture-sequence-anchor';

const asLocalDate = (value: DateValue, fallback: Date): Date => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fromLocalDateString(value);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
  return fallback;
};

/** Account creation day is day 1; dates before it are safely clamped to day 1. */
export const getAccountSequenceNumber = (
  selectedDate: string | Date,
  accountCreatedAt: DateValue,
  cycleLength: number,
): number => {
  const target = startOfDay(asLocalDate(selectedDate, new Date()));
  const created = startOfDay(asLocalDate(accountCreatedAt, target));
  const elapsedDays = Math.max(0, differenceInCalendarDays(target, created));
  return (elapsedDays % cycleLength) + 1;
};

export const getDailyPsalmNumber = (
  selectedDate: string | Date,
  accountCreatedAt: DateValue,
): number => getAccountSequenceNumber(selectedDate, accountCreatedAt, 150);

const validPsalmNumber = (value: unknown): number | null => {
  const psalm = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(psalm) && psalm >= 1 && psalm <= 150 ? psalm : null;
};

const psalmNumberFromReference = (value: unknown): number | null => {
  if (typeof value !== 'string') {return null;}
  const match = value.match(/\bPsalm\s+(\d{1,3})\b/i);
  return validPsalmNumber(match?.[1]);
};

/** Recover a Psalm identity after the former revisit fallback overwrote it. */
export const resolveSavedPsalmNumber = (
  entry: {title?: unknown; content?: unknown; metadata?: Record<string, any>} | null | undefined,
  fallback: number,
): number => {
  const metadata = entry?.metadata || {};
  const labels = Array.isArray(metadata.selectedAttributes)
    ? metadata.selectedAttributes.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  if (labels.length) {
    const matches = psalmReflections.filter(psalm => labels.every(label =>
      psalm.attributes.some(attribute => attribute.label === label),
    ));
    if (matches.length === 1) {return matches[0].psalm;}
  }
  return psalmNumberFromReference(metadata.psalmReference)
    ?? validPsalmNumber(metadata.psalmNumber)
    ?? psalmNumberFromReference(entry?.title)
    ?? validPsalmNumber(fallback)
    ?? 1;
};

export const getDailyProverbNumber = (
  selectedDate: string | Date,
  accountCreatedAt: DateValue,
): number => getAccountSequenceNumber(selectedDate, accountCreatedAt, 31);

const validProverbChapter = (value: unknown): number | null => {
  const chapter = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 31 ? chapter : null;
};

const proverbChapterFromReference = (value: unknown): number | null => {
  if (typeof value !== 'string') {return null;}
  const match = value.match(/\bProverbs\s+(\d{1,2})\b/i);
  return validProverbChapter(match?.[1]);
};

/**
 * Resolve the chapter belonging to a saved Proverbs reflection. The selected
 * wisdom verse is the strongest evidence because an older revisit bug could
 * overwrite the record title and proverbNumber with a fallback chapter.
 */
export const resolveSavedProverbNumber = (
  entry: {title?: unknown; metadata?: Record<string, any>} | null | undefined,
  fallback: number,
): number => {
  const metadata = entry?.metadata || {};
  const selectedWisdom = Array.isArray(metadata.selectedWisdom) ? metadata.selectedWisdom : [];
  for (const wisdom of selectedWisdom) {
    const reference = wisdom && typeof wisdom === 'object' ? wisdom.verses : '';
    const chapter = proverbChapterFromReference(reference);
    if (chapter) {return chapter;}
  }
  const selectedIds = Array.isArray(metadata.selectedWisdomIds) ? metadata.selectedWisdomIds : [];
  for (const id of selectedIds) {
    const match = typeof id === 'string' ? id.match(/^(\d{1,2})-/) : null;
    const chapter = validProverbChapter(match?.[1]);
    if (chapter) {return chapter;}
  }
  return proverbChapterFromReference(metadata.proverbReference)
    ?? validProverbChapter(metadata.proverbNumber)
    ?? proverbChapterFromReference(entry?.title)
    ?? validProverbChapter(fallback)
    ?? 1;
};
