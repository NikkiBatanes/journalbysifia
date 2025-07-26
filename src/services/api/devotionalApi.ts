// src/services/api/devotionalApi.ts
import { supabase } from '../supabaseApi';
import { Devotional, DevotionalCreationParams } from '../../interfaces/devotional';
import { Playbook } from '../../interfaces/playbook';

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
      console.error('Error fetching devotionals:', error);
      throw new Error(`Failed to fetch devotionals: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a specific devotional by ID
   */
  static async getDevotionalById(id: string): Promise<DevotionalApiEntry | null> {
    console.log('[DevotionalApi] getDevotionalById called with ID:', id);

    // Check if ID looks like a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.warn('[DevotionalApi] Invalid UUID format:', id);
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
      console.error('Error fetching devotional:', error);
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
      console.error('Error creating devotional:', error);
      throw new Error(`Failed to create devotional: ${error.message}`);
    }

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
      console.error('Error updating devotional:', error);
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
      console.error('Error deleting devotional:', error);
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
      console.error('Error fetching playbook:', error);
      throw new Error(`Failed to fetch playbook: ${error.message}`);
    }

    return data;
  }

  /**
   * Generate a new devotional using AI
   */
  static async generateDevotional(params: DevotionalCreationParams): Promise<Devotional> {
    // This would call the existing generateDevotional function
    const { generateDevotional } = await import('../supabaseApi');
    return generateDevotional(params.duration, params.playbookId, params.userInput);
  }
}
