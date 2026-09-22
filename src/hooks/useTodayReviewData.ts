import { useEffect, useState } from 'react';
import { getReviewEligibility, type ReviewEligibilityResult } from '../services/reviewEligibilityService';
import { getLocalReviewsByType, type LocalReviewEntry } from '../storage/reviewStorage';
import { getActiveReviewQAContext, getReviewQAEligibilityOptions, type ActiveReviewQAContext } from '../dev/reviews/reviewQALoader';

/** Review availability must not wait for activity counts or completed-review history. */
export const useTodayReviewData = (todayKey: string, weekStart: string, refresh: number) => {
  const [eligibility, setEligibility] = useState<ReviewEligibilityResult | null>(null);
  const [weeklyReviews, setWeeklyReviews] = useState<LocalReviewEntry[]>([]);
  const [reviewQAContext, setReviewQAContext] = useState<ActiveReviewQAContext | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const qaContext = __DEV__ ? await getActiveReviewQAContext() : null;
        const nextEligibility = await getReviewEligibility(
          qaContext?.referenceDate ?? todayKey,
          weekStart,
          qaContext ? getReviewQAEligibilityOptions(qaContext) : undefined,
        );
        if (!active) { return; }
        setEligibility(nextEligibility);
        setReviewQAContext(qaContext);
      } catch (error) {
        if (__DEV__) { console.error('[Today] Review availability failed', error); }
      }
    })();
    // The saved "From your week" card is independent of a pending review.
    void getLocalReviewsByType('weekly').then(reviews => {
      if (active) { setWeeklyReviews(reviews); }
    }).catch(error => {
      if (__DEV__) { console.error('[Today] Weekly review history failed', error); }
    });
    return () => { active = false; };
  }, [todayKey, weekStart, refresh]);

  return { eligibility, weeklyReviews, reviewQAContext };
};
