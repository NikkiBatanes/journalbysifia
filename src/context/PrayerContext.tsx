import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  PrayerEntry,
  JournalCategory,
  savePrayerEntry,
  updatePrayerEntry,
  deletePrayerEntry,
  getLocalPrayers,
  syncPrayersFromCloud,
  forceRefreshPrayers,
  testDatabaseConnection,
  getAllDevotionalPrayersFromCloud,
  generateUUID,
} from '../storage/prayerStorage';
import { toLocalDateString } from '../utils/date';

// Legacy interface for backward compatibility
export interface PrayedItem {
  id: string;
  text: string;
  date: Date;
  devotionalTitle: string;
  totalDays?: number;
  dayNumber?: number;
  dayTitle?: string;
}

interface PrayerContextType {
  // Legacy support
  prayedItems: PrayedItem[];
  addPrayedItem: (text: string, metadata: Omit<PrayedItem, 'id' | 'text' | 'date'>) => void;
  clearPrayedItems: () => void;

  // New prayer system
  prayers: PrayerEntry[];
  loading: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  // Prayer operations
  addPrayer: (prayer: Omit<PrayerEntry, 'id' | 'user_id' | 'version' | 'created_at' | 'updated_at'>) => Promise<PrayerEntry>;
  updatePrayer: (prayerId: string, updates: Partial<PrayerEntry>) => Promise<PrayerEntry>;
  deletePrayer: (prayerId: string) => Promise<void>;

  // Filtered prayers
  journalPrayers: PrayerEntry[];
  peoplePrayers: PrayerEntry[];
  devotionalPrayers: PrayerEntry[];

  // Utility functions
  getPrayersByCategory: (category: JournalCategory) => PrayerEntry[];
  getPrayerRequests: () => PrayerEntry[];
  getPersonalPrayers: () => PrayerEntry[];
  getAllDevotionalPrayers: () => Promise<PrayerEntry[]>;

  // Sync functions
  refreshPrayers: () => Promise<void>;
  forceRefresh: () => Promise<void>;

  // Debug functions
  debugDevotionalPrayers: () => Promise<void>;
  clearAllDevotionalPrayers: () => Promise<void>;
}

const PrayerContext = createContext<PrayerContextType | undefined>(undefined);

export const PrayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [prayers, setPrayers] = useState<PrayerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [prayedItems, setPrayedItems] = useState<PrayedItem[]>([]);

  // Convert date to string for storage operations
  const dateStr = toLocalDateString(selectedDate);

  // Cache for all devotional prayers (loaded once)
  const [allDevotionalPrayersCache, setAllDevotionalPrayersCache] = useState<PrayerEntry[]>([]);
  const [devotionalPrayersLoaded, setDevotionalPrayersLoaded] = useState(false);

  // Load all devotional prayers once (for caching)
  const loadAllDevotionalPrayers = useCallback(async () => {
    if (!user || devotionalPrayersLoaded) {return;}

    try {
      console.log('📚 Loading ALL devotional prayers for caching...');
      const allDevotionalPrayers = await getAllDevotionalPrayersFromCloud(user.id);
      setAllDevotionalPrayersCache(allDevotionalPrayers);
      setDevotionalPrayersLoaded(true);
      console.log(`✅ Cached ${allDevotionalPrayers.length} devotional prayers`);
    } catch (error) {
      console.error('❌ Error loading devotional prayers cache:', error);
    }
  }, [user, devotionalPrayersLoaded]);

  // Load prayers when user or date changes
  const loadPrayers = useCallback(async () => {
    if (!user) {return;}

    setLoading(true);

    try {
      // Test database connection first
      await testDatabaseConnection();

      const localPrayers = await getLocalPrayers(user.id, dateStr);
      setPrayers(localPrayers);

      // Background sync from cloud
      try {
        const cloudPrayers = await syncPrayersFromCloud(user.id, dateStr);
        setPrayers(cloudPrayers);
      } catch (error) {
        console.error('Background sync failed:', error);
        // Continue with local prayers
      }

      // Load devotional prayers cache if not loaded
      await loadAllDevotionalPrayers();

    } catch (error) {
      console.error('Error loading prayers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, dateStr, loadAllDevotionalPrayers]);

  // Filter prayedItems when date changes or cache is loaded
  useEffect(() => {
    if (devotionalPrayersLoaded && allDevotionalPrayersCache.length > 0) {
      console.log(`🔍 Filtering cached devotional prayers for date: ${dateStr}`);

      const filteredPrayers = allDevotionalPrayersCache.filter(prayer => {
        const prayerDate = prayer.selected_date || prayer.created_at.split('T')[0];
        return prayerDate === dateStr;
      });

      console.log(`📊 Found ${filteredPrayers.length} devotional prayers for date ${dateStr} (from cache)`);

      // Convert to prayedItems format
      const convertedPrayedItems: PrayedItem[] = filteredPrayers.map(prayer => ({
        id: prayer.id,
        text: prayer.content,
        date: new Date(prayer.created_at),
        devotionalTitle: prayer.devotional_title || 'Devotional',
        totalDays: prayer.total_days,
        dayNumber: prayer.day_number,
        dayTitle: prayer.day_title,
      }));

      setPrayedItems(convertedPrayedItems);
      console.log(`✅ Set prayedItems for ${dateStr}:`, convertedPrayedItems.length);
    }
  }, [dateStr, devotionalPrayersLoaded, allDevotionalPrayersCache]);

  // Load prayers on mount and when dependencies change
  useEffect(() => {
    loadPrayers();
  }, [loadPrayers]);

  // Prayer operations
  const addPrayer = useCallback(async (
    prayer: Omit<PrayerEntry, 'id' | 'user_id' | 'version' | 'created_at' | 'updated_at'>
  ): Promise<PrayerEntry> => {
    if (!user) {throw new Error('User not authenticated');}

    const newPrayer = await savePrayerEntry(user.id, dateStr, prayer);
    setPrayers(prev => [newPrayer, ...prev]);
    return newPrayer;
  }, [user, dateStr]);

  const updatePrayer = useCallback(async (
    prayerId: string,
    updates: Partial<PrayerEntry>
  ): Promise<PrayerEntry> => {
    if (!user) {throw new Error('User not authenticated');}

    const updatedPrayer = await updatePrayerEntry(user.id, dateStr, prayerId, updates);
    setPrayers(prev => prev.map(p => p.id === prayerId ? updatedPrayer : p));
    return updatedPrayer;
  }, [user, dateStr]);

  const deletePrayer = useCallback(async (prayerId: string): Promise<void> => {
    if (!user) {throw new Error('User not authenticated');}

    await deletePrayerEntry(user.id, dateStr, prayerId);
    setPrayers(prev => prev.filter(p => p.id !== prayerId));
  }, [user, dateStr]);

  // Filtered prayers
  const journalPrayers = prayers.filter(p => p.prayer_type === 'journal');
  const peoplePrayers = prayers.filter(p => p.prayer_type === 'people');
  const devotionalPrayers = prayers.filter(p => p.prayer_type === 'devotional');

  // Utility functions
  const getPrayersByCategory = useCallback((category: JournalCategory): PrayerEntry[] => {
    return journalPrayers.filter(p => p.journal_category === category);
  }, [journalPrayers]);

  const getPrayerRequests = useCallback((): PrayerEntry[] => {
    return peoplePrayers.filter(p => p.is_prayer_request === true);
  }, [peoplePrayers]);

  const getPersonalPrayers = useCallback((): PrayerEntry[] => {
    return peoplePrayers.filter(p => p.is_prayer_request === false);
  }, [peoplePrayers]);

  const getAllDevotionalPrayers = useCallback(async (): Promise<PrayerEntry[]> => {
    if (!user) {return [];}

    try {
      // Get all devotional prayers from cloud database regardless of date
      const allDevotionalPrayers = await getAllDevotionalPrayersFromCloud(user.id);
      console.log('📚 Loaded all devotional prayers:', allDevotionalPrayers.length);
      return allDevotionalPrayers;
    } catch (error) {
      console.error('Error loading all devotional prayers:', error);
      return [];
    }
  }, [user]);

  // Sync functions
  const refreshPrayers = useCallback(async (): Promise<void> => {
    await loadPrayers();
  }, [loadPrayers]);

  const forceRefresh = useCallback(async (): Promise<void> => {
    if (!user) {return;}

    setLoading(true);
    try {
      const refreshedPrayers = await forceRefreshPrayers(user.id, dateStr);
      setPrayers(refreshedPrayers);
    } catch (error) {
      console.error('Error force refreshing prayers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, dateStr]);

  // Legacy support functions
  const addPrayedItem = useCallback((text: string, metadata: Omit<PrayedItem, 'id' | 'text' | 'date'>) => {
    // Check for duplicates based on devotional title, day number, and day title
    const isDuplicate = prayedItems.some(item =>
      item.devotionalTitle === metadata.devotionalTitle &&
      item.dayNumber === metadata.dayNumber &&
      item.dayTitle === metadata.dayTitle
    );

    if (isDuplicate) {
      console.log('⚠️ Duplicate prayed item detected, skipping:', metadata);
      return;
    }

    // Use current date for devotional prayers (when they were actually prayed)
    const currentDate = toLocalDateString(new Date());

    const newItem: PrayedItem = {
      id: generateUUID(),
      text,
      date: new Date(),
      ...metadata,
    };

    // Only add to local prayedItems if the current date matches the selected date
    if (currentDate === dateStr) {
      setPrayedItems(prev => [...prev, newItem]);
      console.log('✅ Added prayed item to local state (current date matches selected):', newItem);
    } else {
      console.log('📅 Prayed item saved to database but not added to local state (different date):', {
        currentDate,
        selectedDate: dateStr,
        item: newItem,
      });
    }

    // Also save to new prayer system if user is available
    if (user) {
      console.log(`📅 Saving devotional prayer with current date: ${currentDate}`);

      addPrayer({
        content: text,
        prayer_type: 'devotional',
        title: `${metadata.devotionalTitle} - Day ${metadata.dayNumber}`,
        selected_date: currentDate, // Use current date, not selected date
        devotional_title: metadata.devotionalTitle,
        day_number: metadata.dayNumber,
        day_title: metadata.dayTitle,
        total_days: metadata.totalDays,
        status: 'pending',
      }).then(newPrayer => {
        // Add to cache immediately
        setAllDevotionalPrayersCache(prev => [newPrayer, ...prev]);
        console.log('✅ Added new prayer to devotional cache');

        // Re-filter for current date (trigger useEffect)
        setDevotionalPrayersLoaded(true);
      }).catch(error => {
        console.error('Error adding prayer to new system:', error);
      });
    }
  }, [user, dateStr, addPrayer, prayedItems]);

  const clearPrayedItems = useCallback(() => {
    setPrayedItems([]);
  }, []);

  // Debug function to show all devotional prayers and their dates
  const debugDevotionalPrayers = useCallback(async () => {
    if (!user) {return;}

    try {
      const allDevotionalPrayers = await getAllDevotionalPrayersFromCloud(user.id);
      console.log('🔍=== DEBUG: All Devotional Prayers in Database ===');
      console.log('Total count:', allDevotionalPrayers.length);

      allDevotionalPrayers.forEach((prayer, index) => {
        console.log(`Prayer ${index + 1}:`, {
          id: prayer.id,
          selected_date: prayer.selected_date,
          created_at: prayer.created_at,
          devotional_title: prayer.devotional_title,
          day_number: prayer.day_number,
          content: prayer.content?.substring(0, 50) + '...',
        });
      });

      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('❌ Error debugging devotional prayers:', error);
    }
  }, [user]);

  // Debug function to clear all devotional prayers
  const clearAllDevotionalPrayers = useCallback(async () => {
    if (!user) {return;}

    try {
      const allDevotionalPrayers = await getAllDevotionalPrayersFromCloud(user.id);
      console.log('🗑️ Found devotional prayers to clear:', allDevotionalPrayers.length);

      for (const prayer of allDevotionalPrayers) {
        await deletePrayer(prayer.id);
        console.log('❌ Deleted devotional prayer:', prayer.id);
      }

      // Clear local state
      setPrayedItems([]);
      await loadPrayers(); // Reload

      console.log('✅ All devotional prayers cleared');
    } catch (error) {
      console.error('❌ Error clearing devotional prayers:', error);
    }
  }, [user, deletePrayer, loadPrayers]);

  const contextValue: PrayerContextType = {
    // Legacy support
    prayedItems,
    addPrayedItem,
    clearPrayedItems,

    // New prayer system
    prayers,
    loading,
    selectedDate,
    setSelectedDate,

    // Prayer operations
    addPrayer,
    updatePrayer,
    deletePrayer,

    // Filtered prayers
    journalPrayers,
    peoplePrayers,
    devotionalPrayers,

    // Utility functions
    getPrayersByCategory,
    getPrayerRequests,
    getPersonalPrayers,
    getAllDevotionalPrayers,

    // Sync functions
    refreshPrayers,
    forceRefresh,

    // Debug functions
    debugDevotionalPrayers,
    clearAllDevotionalPrayers,
  };

  return (
    <PrayerContext.Provider value={contextValue}>
      {children}
    </PrayerContext.Provider>
  );
};

export const usePrayer = (): PrayerContextType => {
  const context = useContext(PrayerContext);
  if (!context) {
    throw new Error('usePrayer must be used within a PrayerProvider');
  }
  return context;
};
