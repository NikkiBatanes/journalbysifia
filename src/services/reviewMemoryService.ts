import {
  getAllLocalReviews,
  type LocalReviewEntry,
  type ReviewMemorableItem,
  type ReviewType,
} from '../storage/reviewStorage';

export interface RememberedMomentReference extends ReviewMemorableItem {
  reviewId: string;
  reviewType: ReviewType;
  reviewStatus: LocalReviewEntry['status'];
}

export interface CanonicalMomentReference {
  id: string;
  selectedDate?: string;
  canonicalIds?: string[];
  prayerId?: string;
  requestId?: string;
}

const CARRY_FORWARD_SOURCES: Partial<Record<ReviewType, ReviewType[]>> = {
  monthly: ['weekly'],
  quarterly: ['monthly'],
  year_end: ['quarterly'],
  begin_year: ['year_end'],
};

const prayerIdFromLegacyEvent = (id: string): string | null => {
  if (!id.startsWith('prayer-review:')) {return null;}
  const parts = id.split(':');
  return parts.length >= 3 && parts[2] ? parts[2] : null;
};

/** Canonical IDs let a remembered review event resolve back to its source Moment. */
export const getRememberedCanonicalIds = (
  item: Pick<ReviewMemorableItem, 'id' | 'canonicalIds'>,
): string[] => {
  const legacyPrayerId = prayerIdFromLegacyEvent(item.id);
  return [...new Set([
    item.id,
    ...(item.canonicalIds ?? []),
    ...(legacyPrayerId ? [legacyPrayerId] : []),
  ].filter(Boolean))];
};

export const getMomentCanonicalIds = (item: CanonicalMomentReference): string[] => [
  item.id,
  ...(item.canonicalIds ?? []),
  ...(item.prayerId ? [item.prayerId] : []),
  ...(item.requestId ? [item.requestId] : []),
].filter(Boolean);

export const rememberedReferenceMatchesMoment = (
  remembered: Pick<ReviewMemorableItem, 'id' | 'canonicalIds'>,
  moment: CanonicalMomentReference,
): boolean => {
  const rememberedIds = new Set(getRememberedCanonicalIds(remembered));
  return getMomentCanonicalIds(moment).some(id => rememberedIds.has(id));
};

export const buildRememberedCanonicalIdSet = (
  references: Array<Pick<ReviewMemorableItem, 'id' | 'canonicalIds'>>,
): Set<string> => new Set(references.flatMap(getRememberedCanonicalIds));

export const getRememberedMomentReferences = async (
  completedOnly = false,
): Promise<RememberedMomentReference[]> => {
  const reviews = await getAllLocalReviews();
  return reviews
    .filter(review => !completedOnly || review.status === 'completed')
    .flatMap(review => review.memorableItems.map(item => ({
      ...item,
      reviewId: review.id,
      reviewType: review.type,
      reviewStatus: review.status,
    })));
};

export const getCarryForwardReferences = async (
  reviewType: ReviewType,
  periodStart: string,
  periodEnd: string,
): Promise<RememberedMomentReference[]> => {
  const sourceTypes = CARRY_FORWARD_SOURCES[reviewType] ?? [];
  if (!sourceTypes.length) {return [];}
  const references = await getRememberedMomentReferences(true);
  return references.filter(reference =>
    sourceTypes.includes(reference.reviewType)
    && reference.selectedDate >= periodStart
    && reference.selectedDate <= periodEnd,
  );
};

export const getCarryForwardSourceTypes = (reviewType: ReviewType): ReviewType[] =>
  CARRY_FORWARD_SOURCES[reviewType] ?? [];
