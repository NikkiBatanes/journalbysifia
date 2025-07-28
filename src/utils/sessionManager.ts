/**
 * Session Manager - Facebook/Instagram Style Persistent Sessions
 * Handles session persistence, automatic refresh, and graceful error handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';

interface SessionInfo {
  lastActivity: number;
  refreshAttempts: number;
  isOnline: boolean;
}

class SessionManager {
  private static instance: SessionManager;
  private sessionInfo: SessionInfo = {
    lastActivity: Date.now(),
    refreshAttempts: 0,
    isOnline: true,
  };

  private readonly SESSION_INFO_KEY = 'session_info';
  private readonly MAX_REFRESH_ATTEMPTS = 5;
  private readonly SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30 days like Facebook

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async initialize() {
    try {
      const storedInfo = await AsyncStorage.getItem(this.SESSION_INFO_KEY);
      if (storedInfo) {
        this.sessionInfo = { ...this.sessionInfo, ...JSON.parse(storedInfo) };
      }
    } catch (error) {
      console.error('[SessionManager] Failed to load session info:', error);
    }
  }

  async updateActivity() {
    this.sessionInfo.lastActivity = Date.now();
    await this.saveSessionInfo();
  }

  async saveSessionInfo() {
    try {
      await AsyncStorage.setItem(this.SESSION_INFO_KEY, JSON.stringify(this.sessionInfo));
    } catch (error) {
      console.error('[SessionManager] Failed to save session info:', error);
    }
  }

  isSessionExpired(): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - this.sessionInfo.lastActivity;
    return timeSinceLastActivity > this.SESSION_TIMEOUT;
  }

  shouldAttemptRefresh(): boolean {
    return this.sessionInfo.refreshAttempts < this.MAX_REFRESH_ATTEMPTS && !this.isSessionExpired();
  }

  async incrementRefreshAttempts() {
    this.sessionInfo.refreshAttempts++;
    await this.saveSessionInfo();
  }

  async resetRefreshAttempts() {
    this.sessionInfo.refreshAttempts = 0;
    await this.saveSessionInfo();
  }

  async handleSessionError(error: any): Promise<boolean> {
    console.log('[SessionManager] Handling session error:', error.message);

    // Don't logout for network errors
    if (this.isNetworkError(error)) {
      console.log('[SessionManager] Network error detected, maintaining session');
      return false; // Don't logout
    }

    // Don't logout if we can still refresh
    if (this.shouldAttemptRefresh()) {
      console.log('[SessionManager] Session error, but will attempt refresh');
      await this.incrementRefreshAttempts();
      return false; // Don't logout
    }

    // Only logout if session is truly expired or max attempts reached
    if (this.isSessionExpired() || this.sessionInfo.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
      console.log('[SessionManager] Session expired or max refresh attempts reached');
      await this.clearSessionInfo();
      return true; // Logout
    }

    return false; // Don't logout by default
  }

  private isNetworkError(error: any): boolean {
    const networkErrorMessages = [
      'network',
      'connection',
      'timeout',
      'fetch',
      'offline',
      'unreachable',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return networkErrorMessages.some(msg => errorMessage.includes(msg));
  }

  async clearSessionInfo() {
    this.sessionInfo = {
      lastActivity: Date.now(),
      refreshAttempts: 0,
      isOnline: true,
    };
    await AsyncStorage.removeItem(this.SESSION_INFO_KEY);
  }

  // Facebook/Instagram style session validation
  async validateSession(): Promise<{ isValid: boolean; shouldRefresh: boolean }> {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      const shouldLogout = await this.handleSessionError(error);
      return { isValid: false, shouldRefresh: !shouldLogout };
    }

    if (!session) {
      return { isValid: false, shouldRefresh: false };
    }

    // Check if token is close to expiry (refresh 5 minutes before expiry)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt - now < fiveMinutes) {
      console.log('[SessionManager] Token close to expiry, should refresh');
      return { isValid: true, shouldRefresh: true };
    }

    await this.updateActivity();
    await this.resetRefreshAttempts();
    return { isValid: true, shouldRefresh: false };
  }

  // Get user-friendly error message
  getUserFriendlyErrorMessage(error: any): string {
    if (this.isNetworkError(error)) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }

    if (this.isSessionExpired()) {
      return 'Your session has expired. Please sign in again.';
    }

    if (this.sessionInfo.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
      return 'Unable to refresh your session. Please sign in again.';
    }

    return 'Something went wrong. Please try again.';
  }
}

export default SessionManager;
