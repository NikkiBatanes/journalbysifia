import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Devotional, DevotionalCreationParams } from '../interfaces/devotional';
import { generateDevotional } from '../services/supabaseApi';
import { supabase } from '../services/supabaseApi';
import { Playbook } from '../interfaces/playbook';
import { createFallbackDevotional } from '../utils/devotionalUtils';

interface DevotionalContextType {
  devotionals: Devotional[];
  isLoading: boolean;
  error: string | null;

  createDevotional: (params: DevotionalCreationParams) => Promise<Devotional | null>;
  getDevotionalById: (id: string) => Devotional | undefined;
  markDayComplete: (devotionalId: string, dayNumber: number) => Promise<boolean>;
  deleteDevotional: (id: string) => Promise<boolean>;
  refreshDevotionals: () => Promise<void>;
  fetchPlaybookById: (id: string) => Promise<Playbook | null>;
  submitDevotionalRating: (devotionalId: string, rating: number) => Promise<boolean>;
}

export const DevotionalContext = createContext<DevotionalContextType>({
  devotionals: [],
  isLoading: false,
  error: null,

  createDevotional: () => Promise.resolve(null),
  getDevotionalById: () => undefined,
  markDayComplete: () => Promise.resolve(false),
  deleteDevotional: () => Promise.resolve(false),
  refreshDevotionals: () => Promise.resolve(),
  fetchPlaybookById: () => Promise.resolve(null),
  submitDevotionalRating: () => Promise.resolve(false),
});

const DEVOTIONALS_STORAGE_KEY = '@devotionals';

export const DevotionalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const showSuccess = useCallback((message: string) => {
    console.log('Success:', message);
  }, []);

  const loadDevotionalsData = useCallback(async (): Promise<Devotional[]> => {
    try {
      console.log('Loading devotionals from storage...');
      const storedDevotionals = await AsyncStorage.getItem(DEVOTIONALS_STORAGE_KEY);
      if (storedDevotionals) {
        const parsedDevotionals = JSON.parse(storedDevotionals);
        console.log('Loaded devotionals:', parsedDevotionals);
        return parsedDevotionals;
      }
      console.log('No devotionals found in storage');
      return [];
    } catch (err) {
      const errorMessage = 'Failed to load devotionals';
      console.error(errorMessage, err);
      setError(errorMessage);
      return [];
    }
  }, []);

  // Load devotionals from storage on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await loadDevotionalsData();
        if (isMounted) {
          setDevotionals(data);
        }
      } catch (err) {
        console.error('Error loading devotionals:', err);
        if (isMounted) {
          setError('Failed to load devotionals');
          setDevotionals([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [loadDevotionalsData]);

  // Save devotionals to AsyncStorage
  const saveDevotionals = async (updatedDevotionals: Devotional[]) => {
    try {
      await AsyncStorage.setItem(DEVOTIONALS_STORAGE_KEY, JSON.stringify(updatedDevotionals));
    } catch (err) {
      console.error('Error saving devotionals:', err);
      throw new Error('Failed to save devotionals');
    }
  };

  // Fetch playbook by ID
  const fetchPlaybookById = async (playbookId: string): Promise<Playbook | null> => {
    try {
      // Clean up the playbook ID by removing any pipe characters and trimming whitespace
      const cleanPlaybookId = playbookId.replace(/\|/g, '').trim();

      if (!cleanPlaybookId) {
        console.error('Invalid playbook ID after cleanup');
        return null;
      }

      console.log('Fetching playbook with ID:', cleanPlaybookId);

      const { data, error: fetchError } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', cleanPlaybookId)
        .single();

      if (fetchError) {
        console.error('Supabase fetch error:', fetchError);
        throw fetchError;
      }

      if (!data) {
        console.error('No playbook found with ID:', cleanPlaybookId);
        return null;
      }

      console.log('Successfully fetched playbook:', { id: data.id, title: data.title });
      return data as Playbook;
    } catch (fetchError) {
      console.error('Error fetching playbook:', fetchError);
      return null;
    }
  };

  // Create a new devotional
  const createDevotional = async (params: DevotionalCreationParams): Promise<Devotional | null> => {
    try {
      setIsLoading(true);
      setError(null);

      let devotional;
      try {
        // Try to generate a devotional with retries
        devotional = await generateDevotional(
          params.duration,
          params.playbookId,
          params.userInput,
          2 // Number of retries
        );

        // Log success if we got here
        console.log('Devotional generated successfully:', {
          id: devotional.id,
          days: devotional.days?.length,
          playbookId: params.playbookId,
        });
      } catch (generationError) {
        console.error('Error generating devotional, using fallback:', generationError);
        // Create a fallback devotional if generation fails
        devotional = createFallbackDevotional(
          params.duration,
          params.playbookId,
          params.userInput
        );

        // Show a warning to the user
        showSuccess('Using fallback devotional content');
      }

      // Ensure the devotional has all required fields and proper structure
      const devotionalWithProgress = {
        ...devotional,
        id: devotional.id || `dev_${Date.now()}`,
        playbookId: params.playbookId,
        userInput: params.userInput || devotional.userInput,
        progress: 0, // Initialize progress to 0 for new devotionals
        days: (devotional.days || []).map((day: Devotional['days'][number]) => ({
          ...day,
          completed: false, // Ensure all days start as not completed
        })),
        createdAt: devotional.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to state and save
      const updatedDevotionals = [...devotionals, devotionalWithProgress];
      setDevotionals(updatedDevotionals);
      await saveDevotionals(updatedDevotionals);

      // Show success message if we didn't already show a fallback message
      if (!devotional.isFallback) {
        showSuccess('Devotional created successfully!');
      }

      return devotionalWithProgress;
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
        completedAt: new Date().toISOString(),
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
        updatedAt: new Date().toISOString(),
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
  const refreshDevotionals = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const data = await loadDevotionalsData();
      setDevotionals(data);
      setError(null);
    } catch (err) {
      console.error('Error refreshing devotionals:', err);
      setError('Failed to refresh devotionals');
    } finally {
      setIsLoading(false);
    }
  }, [loadDevotionalsData]);

  // Submit a rating for a completed devotional
  const submitDevotionalRating = async (devotionalId: string, rating: number): Promise<boolean> => {
    try {
      const devotionalIndex = devotionals.findIndex(d => d.id === devotionalId);
      if (devotionalIndex === -1) {
        console.error('Devotional not found:', devotionalId);
        return false;
      }

      const devotional = { ...devotionals[devotionalIndex] };

      // Update the devotional with the rating
      const updatedDevotional = {
        ...devotional,
        rating,
        ratedAt: new Date().toISOString(),
      };

      // Update state and save
      const updatedDevotionals = [...devotionals];
      updatedDevotionals[devotionalIndex] = updatedDevotional;
      setDevotionals(updatedDevotionals);
      await saveDevotionals(updatedDevotionals);

      console.log(`Rating of ${rating} submitted for devotional ${devotionalId}`);
      return true;
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError('Failed to submit rating');
      return false;
    }
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
        fetchPlaybookById,
        submitDevotionalRating,
      }}
    >
      {children}
    </DevotionalContext.Provider>
  );
};

export const useDevotional = () => useContext(DevotionalContext);
