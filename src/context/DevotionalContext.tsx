import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Devotional, DevotionalDay, DevotionalCreationParams } from '../interfaces/devotional';
import { generateDevotional } from '../services/supabaseApi';

interface DevotionalContextType {
  devotionals: Devotional[];
  isLoading: boolean;
  error: string | null;
  createDevotional: (params: DevotionalCreationParams) => Promise<Devotional | null>;
  getDevotionalById: (id: string) => Devotional | undefined;
  markDayComplete: (devotionalId: string, dayNumber: number) => Promise<boolean>;
  deleteDevotional: (id: string) => Promise<boolean>;
  refreshDevotionals: () => Promise<void>;
}

const DevotionalContext = createContext<DevotionalContextType>({
  devotionals: [],
  isLoading: false,
  error: null,
  createDevotional: async () => null,
  getDevotionalById: () => undefined,
  markDayComplete: async () => false,
  deleteDevotional: async () => false,
  refreshDevotionals: async () => {},
});

const DEVOTIONALS_STORAGE_KEY = '@devotionals';

export const DevotionalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load devotionals from storage on mount
  useEffect(() => {
    loadDevotionals();
  }, []);

  // Load devotionals from AsyncStorage
  const loadDevotionals = async () => {
    try {
      setIsLoading(true);
      const storedDevotionals = await AsyncStorage.getItem(DEVOTIONALS_STORAGE_KEY);
      if (storedDevotionals) {
        setDevotionals(JSON.parse(storedDevotionals));
      }
    } catch (err) {
      setError('Failed to load devotionals');
      console.error('Error loading devotionals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save devotionals to AsyncStorage
  const saveDevotionals = async (updatedDevotionals: Devotional[]) => {
    try {
      await AsyncStorage.setItem(DEVOTIONALS_STORAGE_KEY, JSON.stringify(updatedDevotionals));
    } catch (err) {
      console.error('Error saving devotionals:', err);
      throw new Error('Failed to save devotionals');
    }
  };

  // Create a new devotional
  const createDevotional = async (params: DevotionalCreationParams): Promise<Devotional | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Generate devotional using OpenAI
      const devotional = await generateDevotional(
        params.duration,
        params.playbookId,
        params.userInput
      );

      // Add to state and save
      const updatedDevotionals = [...devotionals, devotional];
      setDevotionals(updatedDevotionals);
      await saveDevotionals(updatedDevotionals);
      
      return devotional;
    } catch (err) {
      console.error('Error creating devotional:', err);
      setError('Failed to create devotional');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Get devotional by ID
  const getDevotionalById = (id: string): Devotional | undefined => {
    return devotionals.find(devotional => devotional.id === id);
  };

  // Mark a day as complete
  const markDayComplete = async (devotionalId: string, dayNumber: number): Promise<boolean> => {
    try {
      console.log(`Marking day ${dayNumber} as complete for devotional ${devotionalId}`);
      
      const devotionalIndex = devotionals.findIndex(d => d.id === devotionalId);
      if (devotionalIndex === -1) {
        console.error('Devotional not found:', devotionalId);
        return false;
      }

      const devotional = { ...devotionals[devotionalIndex] };
      const dayIndex = devotional.days.findIndex(day => day.dayNumber === dayNumber);
      if (dayIndex === -1) {
        console.error('Day not found:', dayNumber, 'in devotional:', devotional.title);
        return false;
      }

      // Check if already completed
      if (devotional.days[dayIndex].completed) {
        console.log('Day already completed, skipping update');
        return true;
      }

      console.log('Updating day:', devotional.days[dayIndex]);
      
      // Update the day
      const updatedDay = { 
        ...devotional.days[dayIndex],
        completed: true,
        completedAt: new Date().toISOString()
      };

      // Update the days array
      const updatedDays = [...devotional.days];
      updatedDays[dayIndex] = updatedDay;
      
      // Calculate progress
      const completedDays = updatedDays.filter(day => day.completed).length;
      const progress = Math.round((completedDays / devotional.totalDays) * 100);
      
      console.log(`Progress: ${completedDays}/${devotional.totalDays} days (${progress}%)`);
      
      // Check if all days are completed
      const allCompleted = completedDays === devotional.totalDays;
      
      // Update the devotional
      const updatedDevotional = {
        ...devotional,
        days: updatedDays,
        currentDay: allCompleted ? devotional.totalDays : Math.min(dayNumber + 1, devotional.totalDays),
        progress,
        completed: allCompleted,
        updatedAt: new Date().toISOString()
      };

      console.log('Updated devotional:', updatedDevotional);
      
      // Update state and save
      const updatedDevotionals = [...devotionals];
      updatedDevotionals[devotionalIndex] = updatedDevotional;
      setDevotionals(updatedDevotionals);
      await saveDevotionals(updatedDevotionals);
      
      console.log('Devotional updated successfully');
      return true;
    } catch (err) {
      console.error('Error marking day complete:', err);
      setError('Failed to mark day as complete');
      return false;
    }
  };

  // Delete a devotional
  const deleteDevotional = async (id: string): Promise<boolean> => {
    try {
      const updatedDevotionals = devotionals.filter(devotional => devotional.id !== id);
      setDevotionals(updatedDevotionals);
      await saveDevotionals(updatedDevotionals);
      return true;
    } catch (err) {
      console.error('Error deleting devotional:', err);
      setError('Failed to delete devotional');
      return false;
    }
  };

  // Refresh devotionals
  const refreshDevotionals = async (): Promise<void> => {
    await loadDevotionals();
  };

  return (
    <DevotionalContext.Provider
      value={{
        devotionals,
        isLoading,
        error,
        createDevotional,
        getDevotionalById,
        markDayComplete,
        deleteDevotional,
        refreshDevotionals,
      }}
    >
      {children}
    </DevotionalContext.Provider>
  );
};

export const useDevotional = () => useContext(DevotionalContext);
