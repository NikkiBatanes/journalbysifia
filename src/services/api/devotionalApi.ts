// src/services/api/devotionalApi.ts
import { supabase } from '../supabaseClient';
import { Logger } from '../../utils/ProductionLogger';
import { DeviceEventEmitter } from 'react-native';
import { Devotional, DevotionalCreationParams } from '../../interfaces/devotional';
import { Playbook } from '../../interfaces/playbook';
import { streakTrackingService } from '../streakTrackingService';

export interface DevotionalApiEntry {
  id: string;
  user_id: string;
  title: string;
  description: string;

  // Category and classification
  category: string;
  categories: string[];

  // Playbook relationship
  playbook_id?: string;
  playbook_title?: string;
  user_input?: string;

  // Progress tracking
  total_days: number;
  current_day: number;
  progress: number;
  completed: boolean;
  completed_at?: string;

  // Content
  days: any[]; // JSON array of devotional days

  // User feedback
  rating?: number;
  rated_at?: string;
  feedback?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export class DevotionalApi {
  /**
   * Get all devotionals for a user
   */
  static async getDevotionals(userId: string): Promise<DevotionalApiEntry[]> {
    const { data, error } = await supabase
      .from('devotionals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error('Error fetching devotionals', error as Error, {
      component: 'devotionalApi',
    });
      throw new Error(`Failed to fetch devotionals: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a specific devotional by ID
   */
  static async getDevotionalById(id: string): Promise<DevotionalApiEntry | null> {

    // Check if ID looks like a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      Logger.warn('[DevotionalApi] Invalid UUID format', {
      component: 'devotionalApi',
      data: id,
    });
      return null;
    }

    const { data, error } = await supabase
      .from('devotionals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      Logger.error('Error fetching devotional', error as Error, {
      component: 'devotionalApi',
    });
      throw new Error(`Failed to fetch devotional: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new devotional
   */
  static async createDevotional(
    devotional: Omit<DevotionalApiEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DevotionalApiEntry> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('devotionals')
      .insert({
        ...devotional,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      Logger.error('Error creating devotional', error as Error, {
      component: 'devotionalApi',
    });
      throw new Error(`Failed to create devotional: ${error.message}`);
    }

    try {
      // Notify listeners (e.g., dashboard carousel) that a new devotional was created
      DeviceEventEmitter.emit('devotional_created', { id: data.id, user_id: data.user_id });
    } catch {}

    return data;
  }

  /**
   * Update a devotional
   */
  static async updateDevotional(
    id: string,
    updates: Partial<Omit<DevotionalApiEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<DevotionalApiEntry> {
    const { data, error } = await supabase
      .from('devotionals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      Logger.error('Error updating devotional', error as Error, {
      component: 'devotionalApi',
    });
      throw new Error(`Failed to update devotional: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark a devotional day as complete
   */
  static async markDayComplete(
    devotionalId: string,
    dayNumber: number
  ): Promise<DevotionalApiEntry> {
    // First get the current devotional
    const devotional = await this.getDevotionalById(devotionalId);
    if (!devotional) {
      throw new Error('Devotional not found');
    }

    // Update the specific day
    const updatedDays = [...devotional.days];
    const dayIndex = dayNumber - 1;

    if (dayIndex >= 0 && dayIndex < updatedDays.length) {
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        completed: true,
        completedAt: new Date().toISOString(),
      };
    }

    // Calculate new progress
    const completedDays = updatedDays.filter(day => day.completed).length;
    const progress = Math.round((completedDays / devotional.total_days) * 100);
    const allCompleted = completedDays === devotional.total_days;

    // Update devotional streak (non-blocking)
    streakTrackingService.updateStreak(devotional.user_id, 'devotional').catch((streakError) => {
      Logger.error('Failed to update devotional streak', streakError as Error, {
        component: 'DevotionalApi',
      });
    });

    // Update the devotional
    return this.updateDevotional(devotionalId, {
      days: updatedDays,
      current_day: allCompleted ? devotional.total_days : Math.min(dayNumber + 1, devotional.total_days),
      progress,
      completed: allCompleted,
    });
  }

  /**
   * Submit a rating for a devotional
   */
  static async submitRating(
    devotionalId: string,
    rating: number
  ): Promise<DevotionalApiEntry> {
    return this.updateDevotional(devotionalId, {
      rating,
      rated_at: new Date().toISOString(),
    });
  }

  /**
   * Delete a devotional
   */
  static async deleteDevotional(id: string): Promise<void> {
    const { error } = await supabase
      .from('devotionals')
      .delete()
      .eq('id', id);

    if (error) {
      Logger.error('Error deleting devotional', error as Error, {
      component: 'devotionalApi',
    });
      throw new Error(`Failed to delete devotional: ${error.message}`);
    }
  }

  /**
   * Get playbook by ID (for devotional creation)
   */
  static async getPlaybookById(id: string): Promise<Playbook | null> {
    const cleanId = id.replace(/\|/g, '').trim();

    if (!cleanId) {
      return null;
    }

    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', cleanId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      Logger.error('Error fetching playbook', error as Error, {
      component: 'devotionalApi',
    });
      throw new Error(`Failed to fetch playbook: ${error.message}`);
    }

    return data;
  }

  /**
   * Generate a new devotional using AI
   */
  static async generateDevotional(params: DevotionalCreationParams): Promise<Devotional> {
    // Get user's Bible version preference from auth context
    let bibleVersion = 'NASB'; // default
    try {
      const { supabase: supabaseClient } = await import('../supabaseClient');
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (user) {
        // Check user_metadata first (where IndustryStandardAuthContext stores it)
        const userMetadata = user.user_metadata;

        if (userMetadata?.preferences?.content?.bibleVersion) {
          bibleVersion = userMetadata.preferences.content.bibleVersion;

        } else {

          // Fallback to user_profiles table
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('preferences')
            .eq('id', user.id)
            .single();

          if (profile?.preferences?.content?.bibleVersion) {
            bibleVersion = profile.preferences.content.bibleVersion;

          } else {

          }
        }
      }
    } catch (error) {

    }

    // Use the modern devotional API directly
    const { generateDevotional } = await import('../modernDevotionalApi');
    return generateDevotional({
      duration: params.duration,
      playbookId: params.playbookId,
      userInput: params.userInput,
      dateOfBirth: params.dateOfBirth,
      isOnboarding: params.isOnboarding || false,
      bibleVersion,
    });
  }
}
