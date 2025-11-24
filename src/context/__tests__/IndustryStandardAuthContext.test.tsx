/**
 * IndustryStandardAuthContext.test.tsx
 * Test suite for authentication context (critical auth component)
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { IndustryStandardAuthProvider, useAuth } from '../IndustryStandardAuthContext';
import { User, LoginCredentials, RegisterData } from '../../types/auth';

// Mock Supabase
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
      getUser: jest.fn(),
    },
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Test component to use auth context
const TestComponent: React.FC<{ onAuth?: (auth: any) => void }> = ({ onAuth }) => {
  const auth = useAuth();
  React.useEffect(() => {
    onAuth?.(auth);
  }, [auth, onAuth]);
  return null;
};

describe('IndustryStandardAuthContext', () => {
  const mockSupabase = require('../../services/supabaseClient').supabase;
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en',
    },
    subscription: {
      tier: 'free',
      status: 'active',
      expiresAt: null,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with loading state', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await waitFor(() => {
        expect(authState.loading).toBe(false);
        expect(authState.user).toBeNull();
      });
    });

    it('should restore user session on initialization', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await waitFor(() => {
        expect(authState.user).toEqual(mockUser);
        expect(authState.loading).toBe(false);
      });
    });
  });

  describe('login functionality', () => {
    it('should login successfully with valid credentials', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.login(credentials);
        expect(result.success).toBe(true);
      });

      await waitFor(() => {
        expect(authState.user).toEqual(mockUser);
      });
    });

    it('should handle login failure with invalid credentials', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials', code: 'invalid_credentials' },
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.login(credentials);
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Invalid credentials');
      });

      expect(authState.user).toBeNull();
    });

    it('should handle network errors during login', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.login(credentials);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('register functionality', () => {
    it('should register successfully with valid data', async () => {
      const registerData: RegisterData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.register(registerData);
        expect(result.success).toBe(true);
      });

      await waitFor(() => {
        expect(authState.user).toEqual(mockUser);
      });
    });

    it('should handle registration failure with existing email', async () => {
      const registerData: RegisterData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already exists', code: 'user_already_exists' },
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.register(registerData);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('user_already_exists');
      });
    });
  });

  describe('logout functionality', () => {
    it('should logout successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      // First login to have a user
      await act(async () => {
        await authState.login({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Then logout
      await act(async () => {
        const result = await authState.logout();
        expect(result.success).toBe(true);
      });

      await waitFor(() => {
        expect(authState.user).toBeNull();
      });
    });

    it('should handle logout errors gracefully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Logout failed', code: 'logout_error' },
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.logout();
        expect(result.success).toBe(false);
      });
    });
  });

  describe('password reset functionality', () => {
    it('should send password reset email successfully', async () => {
      const email = 'test@example.com';
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.resetPassword(email);
        expect(result.success).toBe(true);
      });

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(email);
    });

    it('should handle password reset errors', async () => {
      const email = 'nonexistent@example.com';
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Email not found', code: 'email_not_found' },
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.resetPassword(email);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('email_not_found');
      });
    });
  });

  describe('profile update functionality', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: { ...mockUser, first_name: 'Updated', last_name: 'Name' } },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.updateProfile(updateData);
        expect(result.success).toBe(true);
      });
    });

    it('should handle profile update errors', async () => {
      const updateData = { firstName: 'Test' };
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Update failed', code: 'update_error' },
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.updateProfile(updateData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('social authentication', () => {
    it('should handle Google login successfully', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'google-access-token',
            refresh_token: 'google-refresh-token',
          },
        },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.socialLogin('google', 'google-id-token');
        expect(result.success).toBe(true);
      });

      await waitFor(() => {
        expect(authState.user).toEqual(mockUser);
      });
    });

    it('should handle Apple login successfully', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'apple-access-token',
            refresh_token: 'apple-refresh-token',
          },
        },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.socialLogin('apple', 'apple-id-token');
        expect(result.success).toBe(true);
      });

      await waitFor(() => {
        expect(authState.user).toEqual(mockUser);
      });
    });
  });

  describe('error handling', () => {
    it('should handle malformed responses from Supabase', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: undefined,
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.login({
          email: 'test@example.com',
          password: 'password',
        });
        expect(result.success).toBe(false);
      });
    });

    it('should handle timeout errors', async () => {
      mockSupabase.auth.signInWithPassword.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.login({
          email: 'test@example.com',
          password: 'password',
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('session management', () => {
    it('should handle token refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          },
        },
        error: null,
      });

      let authState: any;
      render(
        <IndustryStandardAuthProvider>
          <TestComponent onAuth={(auth) => (authState = auth)} />
        </IndustryStandardAuthProvider>
      );

      await act(async () => {
        const result = await authState.refreshToken();
        expect(result.success).toBe(true);
      });
    });
  });
});
