/**
 * authApi.test.ts
 * Test suite for the authentication API service (critical auth component)
 */

import { authApi } from '../authApi';
import { supabase } from '../../services/supabaseClient';
import { User, LoginCredentials, AuthError } from '../../types/auth';

// Mock Supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signInWithOAuth: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  },
}));

describe('authApi', () => {
  const mockSupabase = supabase as any;
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    avatar: undefined,
    preferences: {
      theme: 'system',
      notifications: {
        dailyDevotional: true,
        prayerReminders: true,
        journalPrompts: true,
        playbookUpdates: true,
        achievements: true,
        weeklyReports: true,
        pushEnabled: true,
        emailEnabled: true,
        reminderTime: '08:00',
        timezone: 'Asia/Manila'
      },
      privacy: {
        profileVisibility: 'public',
        shareJournal: false,
        shareProgress: true
      },
      content: {
        language: 'en',
        bibleVersion: 'NIV',
        autoPlayAudio: false,
        downloadForOffline: true,
        showVerseOfDay: true
      },
      fontSize: 'medium',
      colorScheme: 'default'
    },
    level: 1,
    experience: 0,
    streak: 0,
    longestStreak: 0,
    totalPoints: 0,
    badges: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastLoginAt: '2024-01-01T00:00:00Z',
    emailVerified: true,
    phoneVerified: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          user: mockUser,
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123'
          }
        },
        error: null
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue(mockResponse);

      const result = await authApi.login(validCredentials);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        user: mockUser,
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      });
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith(validCredentials);
    });

    it('should handle login failure with invalid credentials', async () => {
      const mockError: AuthError = {
        message: 'Invalid login credentials',
        code: 'invalid_credentials'
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await authApi.login(validCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle network errors during login', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await authApi.login(validCredentials);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Network error');
    });

    it('should validate required fields', async () => {
      const invalidCredentials = {
        email: '',
        password: ''
      } as LoginCredentials;

      const result = await authApi.login(invalidCredentials);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const result = await authApi.logout('access-token-123');

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle logout errors', async () => {
      const mockError: AuthError = {
        message: 'Logout failed',
        code: 'logout_error'
      };

      mockSupabase.auth.signOut.mockResolvedValue({ error: mockError });

      const result = await authApi.logout('access-token-123');

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token'
          }
        },
        error: null
      };

      mockSupabase.auth.refreshSession.mockResolvedValue(mockResponse);

      const result = await authApi.refreshToken('old-refresh-token');

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('new-access-token');
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledWith('old-refresh-token');
    });

    it('should handle token refresh failure', async () => {
      const mockError: AuthError = {
        message: 'Invalid refresh token',
        code: 'invalid_refresh_token'
      };

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await authApi.refreshToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('invalid_refresh_token');
    });
  });
});
