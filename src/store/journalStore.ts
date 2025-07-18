import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Journal-specific state store
 * Handles journal UI state, filters, and temporary data
 */

interface JournalState {
  // Current date and navigation
  selectedDate: string; // YYYY-MM-DD format
  currentWeek: Date;
  
  // UI state
  activeJournalTab: 'journal' | 'schedule' | 'prayer' | 'finance';
  isDatePickerVisible: boolean;
  
  // Filters and view options
  gratitudeFilter: 'all' | 'recent' | 'favorites';
  todoFilter: 'all' | 'pending' | 'completed' | 'priority';
  reflectionFilter: 'all' | 'recent' | 'devotional' | 'personal';
  
  // Pagination and limits
  gratitudeLimit: number;
  todoLimit: number;
  reflectionLimit: number;
  
  // Temporary data (not persisted)
  refreshKey: number;
  lastRefreshTime: string | null;
  
  // Draft states
  drafts: {
    gratitude: string[];
    todo: string;
    reflection: {
      title: string;
      content: string;
      mode: 'gratitude' | 'challenge' | 'lesson' | 'prayer' | 'general';
    } | null;
    todaysFocus: string;
  };
}

interface JournalActions {
  // Date navigation
  setSelectedDate: (date: string) => void;
  setCurrentWeek: (week: Date) => void;
  goToToday: () => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  
  // UI state
  setActiveJournalTab: (tab: JournalState['activeJournalTab']) => void;
  setDatePickerVisible: (visible: boolean) => void;
  
  // Filters
  setGratitudeFilter: (filter: JournalState['gratitudeFilter']) => void;
  setTodoFilter: (filter: JournalState['todoFilter']) => void;
  setReflectionFilter: (filter: JournalState['reflectionFilter']) => void;
  
  // Pagination
  setGratitudeLimit: (limit: number) => void;
  setTodoLimit: (limit: number) => void;
  setReflectionLimit: (limit: number) => void;
  
  // Refresh
  triggerRefresh: () => void;
  setLastRefreshTime: (time: string) => void;
  
  // Drafts
  setGratitudeDraft: (gratitude: string[]) => void;
  setTodoDraft: (todo: string) => void;
  setReflectionDraft: (reflection: JournalState['drafts']['reflection']) => void;
  setTodaysFocusDraft: (focus: string) => void;
  clearDrafts: () => void;
  clearDraft: (type: keyof JournalState['drafts']) => void;
  
  // Reset
  resetJournalState: () => void;
}

type JournalStore = JournalState & JournalActions;

const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
};

const initialState: JournalState = {
  // Current date and navigation
  selectedDate: getTodayString(),
  currentWeek: new Date(),
  
  // UI state
  activeJournalTab: 'journal',
  isDatePickerVisible: false,
  
  // Filters and view options
  gratitudeFilter: 'all',
  todoFilter: 'all',
  reflectionFilter: 'all',
  
  // Pagination and limits
  gratitudeLimit: 5,
  todoLimit: 5,
  reflectionLimit: 5,
  
  // Temporary data
  refreshKey: 0,
  lastRefreshTime: null,
  
  // Draft states
  drafts: {
    gratitude: [],
    todo: '',
    reflection: null,
    todaysFocus: '',
  },
};

export const useJournalStore = create<JournalStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,
      
      // Date navigation
      setSelectedDate: (date) => set((state) => {
        state.selectedDate = date;
      }),
      
      setCurrentWeek: (week) => set((state) => {
        state.currentWeek = week;
      }),
      
      goToToday: () => set((state) => {
        state.selectedDate = getTodayString();
      }),
      
      goToPreviousDay: () => set((state) => {
        const currentDate = new Date(state.selectedDate);
        currentDate.setDate(currentDate.getDate() - 1);
        state.selectedDate = currentDate.toISOString().split('T')[0];
      }),
      
      goToNextDay: () => set((state) => {
        const currentDate = new Date(state.selectedDate);
        currentDate.setDate(currentDate.getDate() + 1);
        state.selectedDate = currentDate.toISOString().split('T')[0];
      }),
      
      // UI state
      setActiveJournalTab: (tab) => set((state) => {
        state.activeJournalTab = tab;
      }),
      
      setDatePickerVisible: (visible) => set((state) => {
        state.isDatePickerVisible = visible;
      }),
      
      // Filters
      setGratitudeFilter: (filter) => set((state) => {
        state.gratitudeFilter = filter;
      }),
      
      setTodoFilter: (filter) => set((state) => {
        state.todoFilter = filter;
      }),
      
      setReflectionFilter: (filter) => set((state) => {
        state.reflectionFilter = filter;
      }),
      
      // Pagination
      setGratitudeLimit: (limit) => set((state) => {
        state.gratitudeLimit = limit;
      }),
      
      setTodoLimit: (limit) => set((state) => {
        state.todoLimit = limit;
      }),
      
      setReflectionLimit: (limit) => set((state) => {
        state.reflectionLimit = limit;
      }),
      
      // Refresh
      triggerRefresh: () => set((state) => {
        state.refreshKey += 1;
        state.lastRefreshTime = new Date().toISOString();
      }),
      
      setLastRefreshTime: (time) => set((state) => {
        state.lastRefreshTime = time;
      }),
      
      // Drafts
      setGratitudeDraft: (gratitude) => set((state) => {
        state.drafts.gratitude = gratitude;
      }),
      
      setTodoDraft: (todo) => set((state) => {
        state.drafts.todo = todo;
      }),
      
      setReflectionDraft: (reflection) => set((state) => {
        state.drafts.reflection = reflection;
      }),
      
      setTodaysFocusDraft: (focus) => set((state) => {
        state.drafts.todaysFocus = focus;
      }),
      
      clearDrafts: () => set((state) => {
        state.drafts = {
          gratitude: [],
          todo: '',
          reflection: null,
          todaysFocus: '',
        };
      }),
      
      clearDraft: (type) => set((state) => {
        switch (type) {
          case 'gratitude':
            state.drafts.gratitude = [];
            break;
          case 'todo':
            state.drafts.todo = '';
            break;
          case 'reflection':
            state.drafts.reflection = null;
            break;
          case 'todaysFocus':
            state.drafts.todaysFocus = '';
            break;
        }
      }),
      
      // Reset
      resetJournalState: () => set(() => ({
        ...initialState,
        selectedDate: getTodayString(),
        currentWeek: new Date(),
      })),
    })),
    {
      name: 'journal-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields (not temporary data like refreshKey)
      partialize: (state) => ({
        selectedDate: state.selectedDate,
        currentWeek: state.currentWeek,
        activeJournalTab: state.activeJournalTab,
        gratitudeFilter: state.gratitudeFilter,
        todoFilter: state.todoFilter,
        reflectionFilter: state.reflectionFilter,
        gratitudeLimit: state.gratitudeLimit,
        todoLimit: state.todoLimit,
        reflectionLimit: state.reflectionLimit,
        drafts: state.drafts,
      }),
    }
  )
);

// Selectors for common journal state
export const useSelectedDate = () => useJournalStore((state) => state.selectedDate);
export const useActiveJournalTab = () => useJournalStore((state) => state.activeJournalTab);
export const useRefreshKey = () => useJournalStore((state) => state.refreshKey);
export const useJournalDrafts = () => useJournalStore((state) => state.drafts);
