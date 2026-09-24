import {getDashboardHeaderScripture} from '../data/dashboardHeaderScriptures';
import {
  hydrateStoredScripturePassages,
  preloadScripturePassages,
} from './scriptureReaderService';

/** Today morning/evening plus tomorrow morning/evening, in deterministic order. */
export function getDashboardScripturePrefetchReferences(date = new Date()): string[] {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [...new Set([
    getDashboardHeaderScripture(date, false).passageReference,
    getDashboardHeaderScripture(date, true).passageReference,
    getDashboardHeaderScripture(tomorrow, false).passageReference,
    getDashboardHeaderScripture(tomorrow, true).passageReference,
  ])];
}

/** Starts downloading the dashboard passages as soon as a translation is chosen. */
export function prefetchDashboardScriptures(
  version: string,
  date = new Date(),
): Promise<void> {
  return preloadScripturePassages(getDashboardScripturePrefetchReferences(date), version);
}

/** Disk-only startup hydration. This never delays startup for a network call. */
export function hydrateDashboardScriptures(
  version: string,
  date = new Date(),
): Promise<void> {
  return hydrateStoredScripturePassages(getDashboardScripturePrefetchReferences(date), version);
}
