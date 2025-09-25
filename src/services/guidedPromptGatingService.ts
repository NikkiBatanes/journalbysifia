// Centralized Guided Prompt Gating Service
// Single source of truth for all guided prompt access logic

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GUIDED_PROMPTS } from '../components/journal/reflectionConstants';
import type { SubscriptionTier } from '../types/subscription';

export interface DailyPromptAllocation {
  freePrompts: string[];
  lockedPrompts: string[];
  allPrompts: string[];
}

export interface PromptUsageCheck {
  canUse: boolean;
  isCompleted: boolean;
  requiresUpgrade: boolean;
}

/**
 * Centralized service for guided prompt gating logic
 * Eliminates duplicate implementations across components
 */
export class GuidedPromptGatingService {
  private static instance: GuidedPromptGatingService;

  public static getInstance(): GuidedPromptGatingService {
    if (!GuidedPromptGatingService.instance) {
      GuidedPromptGatingService.instance = new GuidedPromptGatingService();
    }
    return GuidedPromptGatingService.instance;
  }

  /**
   * Get daily prompt allocation for a user based on their tier
   * Uses consistent deterministic randomization
   */
  public getDailyPrompts(userId: string, tier: SubscriptionTier): DailyPromptAllocation {
    // Paid tiers get all prompts unlocked
    if (tier !== 'seeker') {
      return {
        freePrompts: GUIDED_PROMPTS.slice(), // All prompts are free
        lockedPrompts: [],
        allPrompts: GUIDED_PROMPTS.slice()
      };
    }

    // Seeker tier: Show ALL prompts - 2 free + rest locked
    const freePrompts = this.generateConsistentFreePrompts(userId, 2);
    const remainingPrompts = GUIDED_PROMPTS.filter(p => !freePrompts.includes(p));
    
    return {
      freePrompts,
      lockedPrompts: remainingPrompts, // Show ALL remaining prompts as locked
      allPrompts: GUIDED_PROMPTS.slice() // Show ALL prompts
    };
  }

  /**
   * Check if a user can use a specific prompt
   */
  public async canUsePrompt(
    userId: string, 
    tier: SubscriptionTier, 
    prompt: string
  ): Promise<PromptUsageCheck> {
    // Paid tiers can use any prompt
    if (tier !== 'seeker') {
      return {
        canUse: true,
        isCompleted: false,
        requiresUpgrade: false
      };
    }

    // Check if prompt is completed
    const completedPrompts = await this.getCompletedPrompts(userId);
    const isCompleted = completedPrompts.includes(prompt);

    // Get daily allocation to check if prompt is free
    const allocation = this.getDailyPrompts(userId, tier);
    const isFreePrompt = allocation.freePrompts.includes(prompt);

    return {
      canUse: isFreePrompt && !isCompleted,
      isCompleted,
      requiresUpgrade: !isFreePrompt
    };
  }

  /**
   * Mark a prompt as completed/used
   */
  public async markPromptUsed(userId: string, prompt: string): Promise<void> {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const storageKey = `@guided_completed_${dateStr}`;
      
      const existing = await AsyncStorage.getItem(storageKey);
      const completedList: string[] = existing ? JSON.parse(existing) : [];
      
      if (!completedList.includes(prompt)) {
        completedList.push(prompt);
        await AsyncStorage.setItem(storageKey, JSON.stringify(completedList));
      }

      // Emit event for UI updates
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('guided_reflection_completed', { 
        question: prompt, 
        date: dateStr 
      });
    } catch (error) {
      console.error('[GuidedPromptGatingService] Error marking prompt as used:', error);
    }
  }

  /**
   * Get list of completed prompts for today
   */
  public async getCompletedPrompts(userId: string): Promise<string[]> {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const storageKey = `@guided_completed_${dateStr}`;
      const data = await AsyncStorage.getItem(storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[GuidedPromptGatingService] Error loading completed prompts:', error);
      return [];
    }
  }

  /**
   * Generate consistent daily free prompts (same every day for a user)
   * Uses user ID as seed for consistency
   */
  private generateConsistentFreePrompts(userId: string, count: number): string[] {
    const seedStr = `${userId}-free-daily`;
    return this.generateDeterministicPrompts(seedStr, GUIDED_PROMPTS, count);
  }

  /**
   * Generate random daily locked prompts (different each day)
   * Uses user ID + date as seed for daily variation
   */
  private generateDailyLockedPrompts(userId: string, availablePrompts: string[], count: number): string[] {
    const dateStr = new Date().toISOString().slice(0, 10);
    const seedStr = `${userId}-${dateStr}-locked`;
    return this.generateDeterministicPrompts(seedStr, availablePrompts, count);
  }

  /**
   * Core deterministic random generation using Mulberry32 PRNG
   * Ensures consistent results across all components
   */
  private generateDeterministicPrompts(seedStr: string, prompts: string[], count: number): string[] {
    // FNV-1a hash for seed generation
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash ^= seedStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    // Mulberry32 PRNG
    const mulberry32 = (a: number) => () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const rand = mulberry32(hash);

    // Fisher-Yates shuffle with deterministic random
    const indices = Array.from({ length: prompts.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Return first 'count' prompts
    const selectedCount = Math.min(count, indices.length);
    return indices.slice(0, selectedCount).map(idx => prompts[idx]);
  }
}

// Export singleton instance
export const guidedPromptGatingService = GuidedPromptGatingService.getInstance();
