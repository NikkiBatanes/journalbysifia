import { toLocalDateString } from '../utils/date';
import { forceRefreshAllJournalData } from '../storage/journalStorage';
import { forceRefreshReflectionEntries } from '../storage/reflectionStorage';
import { forceRefreshPrayers } from '../storage/prayerStorage';

export interface PreloadProgress {
  journalData: boolean;
  reflectionData: boolean;
  prayerData: boolean;
  completed: boolean;
}

export class DataPreloadService {
  private static instance: DataPreloadService;
  private preloadPromises: Map<string, Promise<void>> = new Map();
  private preloadProgress: Map<string, PreloadProgress> = new Map();

  static getInstance(): DataPreloadService {
    if (!DataPreloadService.instance) {
      DataPreloadService.instance = new DataPreloadService();
    }
    return DataPreloadService.instance;
  }

  /**
   * Preload all user data in parallel for faster UI loading
   */
  async preloadUserData(userId: string, selectedDate: Date = new Date()): Promise<void> {
    const dateStr = toLocalDateString(selectedDate);
    const cacheKey = `${userId}-${dateStr}`;

    // Return existing promise if already preloading
    if (this.preloadPromises.has(cacheKey)) {
      return this.preloadPromises.get(cacheKey)!;
    }

    // Initialize progress tracking
    this.preloadProgress.set(cacheKey, {
      journalData: false,
      reflectionData: false,
      prayerData: false,
      completed: false,
    });

    const preloadPromise = this.executePreload(userId, selectedDate, cacheKey);
    this.preloadPromises.set(cacheKey, preloadPromise);

    return preloadPromise;
  }

  private async executePreload(userId: string, selectedDate: Date, cacheKey: string): Promise<void> {
    const dateStr = toLocalDateString(selectedDate);

    console.log('🚀 Starting parallel data preload for user:', userId, 'date:', dateStr);

    try {
      // Load all data types in parallel for maximum speed
      const [journalResult, reflectionResult, prayerResult] = await Promise.allSettled([
        // Journal data (gratitude, todos, today_win, looking_forward, schedule)
        this.preloadJournalData(userId, selectedDate),

        // Reflection entries
        this.preloadReflectionData(userId, selectedDate),

        // Prayer data
        this.preloadPrayerData(userId, dateStr),
      ]);

      // Update progress tracking
      const progress = this.preloadProgress.get(cacheKey)!;
      progress.journalData = journalResult.status === 'fulfilled';
      progress.reflectionData = reflectionResult.status === 'fulfilled';
      progress.prayerData = prayerResult.status === 'fulfilled';
      progress.completed = true;

      // Log results
      if (journalResult.status === 'rejected') {
        console.error('❌ Journal data preload failed:', journalResult.reason);
      } else {
        console.log('✅ Journal data preloaded successfully');
      }

      if (reflectionResult.status === 'rejected') {
        console.error('❌ Reflection data preload failed:', reflectionResult.reason);
      } else {
        console.log('✅ Reflection data preloaded successfully');
      }

      if (prayerResult.status === 'rejected') {
        console.error('❌ Prayer data preload failed:', prayerResult.reason);
      } else {
        console.log('✅ Prayer data preloaded successfully');
      }

      console.log('🎉 Data preload completed for user:', userId);

    } catch (error) {
      console.error('💥 Critical error during data preload:', error);
      throw error;
    } finally {
      // Clean up promise cache after completion
      setTimeout(() => {
        this.preloadPromises.delete(cacheKey);
        this.preloadProgress.delete(cacheKey);
      }, 5000); // Keep for 5 seconds in case of quick re-access
    }
  }

  private async preloadJournalData(userId: string, selectedDate: Date): Promise<void> {
    console.log('📝 Preloading journal data...');
    await forceRefreshAllJournalData(userId, selectedDate);
  }

  private async preloadReflectionData(userId: string, selectedDate: Date): Promise<void> {
    console.log('💭 Preloading reflection data...');
    await forceRefreshReflectionEntries(userId, selectedDate);
  }

  private async preloadPrayerData(userId: string, dateStr: string): Promise<void> {
    console.log('🙏 Preloading prayer data...');
    await forceRefreshPrayers(userId, dateStr);
  }

  /**
   * Get preload progress for a specific user/date
   */
  getPreloadProgress(userId: string, selectedDate: Date = new Date()): PreloadProgress | null {
    const dateStr = toLocalDateString(selectedDate);
    const cacheKey = `${userId}-${dateStr}`;
    return this.preloadProgress.get(cacheKey) || null;
  }

  /**
   * Check if data is already preloaded
   */
  isDataPreloaded(userId: string, selectedDate: Date = new Date()): boolean {
    const progress = this.getPreloadProgress(userId, selectedDate);
    return progress?.completed || false;
  }

  /**
   * Preload data for multiple dates (useful for week view)
   */
  async preloadMultipleDates(userId: string, dates: Date[]): Promise<void> {
    console.log('📅 Preloading data for multiple dates:', dates.length);

    const preloadPromises = dates.map(date =>
      this.preloadUserData(userId, date).catch(error => {
        console.error(`Failed to preload data for ${toLocalDateString(date)}:`, error);
        return Promise.resolve(); // Don't fail the entire batch
      })
    );

    await Promise.all(preloadPromises);
    console.log('✅ Multi-date preload completed');
  }

  /**
   * Clear all cached preload data (useful for logout)
   */
  clearCache(): void {
    this.preloadPromises.clear();
    this.preloadProgress.clear();
    console.log('🧹 Preload cache cleared');
  }
}

// Export singleton instance
export const dataPreloadService = DataPreloadService.getInstance();
