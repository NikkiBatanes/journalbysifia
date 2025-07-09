import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  prayedItems: PrayedItem[];
  addPrayedItem: (text: string, metadata: Omit<PrayedItem, 'id' | 'text' | 'date'>) => void;
  clearPrayedItems: () => void;
}

const PrayerContext = createContext<PrayerContextType | undefined>(undefined);

export const PrayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prayedItems, setPrayedItems] = useState<PrayedItem[]>([]);

  const addPrayedItem = (text: string, metadata: Omit<PrayedItem, 'id' | 'text' | 'date'>) => {
    const newItem: PrayedItem = {
      id: Date.now().toString(),
      text,
      date: new Date(),
      ...metadata,
    };
    setPrayedItems(prev => [newItem, ...prev]);
  };

  const clearPrayedItems = () => {
    setPrayedItems([]);
  };

  return (
    <PrayerContext.Provider value={{ prayedItems, addPrayedItem, clearPrayedItems }}>
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
