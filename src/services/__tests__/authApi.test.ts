import { authApi } from '../authApi';

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

// Mock ProductionLogger
jest.mock('../../utils/ProductionLogger', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('AuthApiService', () => {
  const mockSupabase = require('../supabaseClient').supabase;
  const { Logger } = require('../../utils/ProductionLogger');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResponse = {
        data: {
          user: {
            id: 'user123',
            email: 'test@example.com',
            created_at: '2023-01-01T00:00:00Z',
            email_confirmed_at: '2023-01-01T00:00:00Z',
          },
          session: {
            access_token: 'token123',
            refresh_token: 'refresh123',
          },
        },
        error: null,
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue(mockResponse);

      // Mock the getUserProfile method
      jest.spyOn(authApi as any, 'getUserProfile').mockResolvedValue({
        first_name: 'Test',
        last_name: 'User',
        display_name: 'Test User',
      });

      jest.spyOn(authApi as any, 'updateLastLogin').mockResolvedValue(null);

      const result = await authApi.login(credentials);

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email,
        password: credentials.password,
      });
      expect(result.success).toBe(true);
      expect(result.data?.user).toBeDefined();
    });

    it('should handle invalid credentials error', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockError = {
        message: 'Invalid login credentials',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await authApi.login(credentials);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    });

    it('should handle unexpected errors', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Unexpected error'));

      const result = await authApi.login(credentials);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'An unexpected error occurred. Please try again.',
        },
      });
    });
  });

  describe('socialLogin', () => {
    it('should successfully login with Google', async () => {
      const socialData = {
        provider: 'google' as const,
        token: 'google-token-123',
        user: {
          id: 'socialuser123',
          email: 'googleuser@example.com',
          firstName: 'Google',
          lastName: 'User',
        },
      };

      const mockResponse = {
        data: {
          user: {
            id: 'socialuser123',
            email: 'googleuser@example.com',
            created_at: '2023-01-01T00:00:00Z',
            email_confirmed_at: '2023-01-01T00:00:00Z',
          },
          session: {
            access_token: 'socialtoken123',
            refresh_token: 'socialrefresh123',
          },
        },
        error: null,
      };

      mockSupabase.auth.signInWithIdToken.mockResolvedValue(mockResponse);

      // Mock helper methods
      jest.spyOn(authApi as any, 'getUserProfile').mockResolvedValue({
        first_name: 'Google',
        last_name: 'User',
      });
      jest.spyOn(authApi as any, 'updateLastLogin').mockResolvedValue(null);

      const result = await authApi.socialLogin(socialData);

      expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-token-123',
      });
      expect(result.success).toBe(true);
    });

    it('should handle unsupported provider', async () => {
      const socialData = {
        provider: 'facebook' as const,
        token: 'facebook-token-123',
        user: {
          id: 'facebookuser123',
          email: 'facebookuser@example.com',
          firstName: 'Facebook',
          lastName: 'User',
        },
      };

      const result = await authApi.socialLogin(socialData);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: 'Social login provider not supported',
        },
      });
      expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      const mockResponse = { error: null };
      mockSupabase.auth.signOut.mockResolvedValue(mockResponse);

      const result = await authApi.logout('token123');

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
      });
    });

    it('should handle logout error gracefully', async () => {
      const mockError = { message: 'Logout failed' };
      mockSupabase.auth.signOut.mockResolvedValue({ error: mockError });

      const result = await authApi.logout('token123');

      expect(result).toEqual({
        success: true, // Always succeeds for logout
      });
    });
  });

  describe('forgotPassword', () => {
    it('should successfully send reset password email', async () => {
      const email = 'test@example.com';
      const mockResponse = { error: null };
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue(mockResponse);

      const result = await authApi.forgotPassword(email);

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(email, {
        redirectTo: 'https://sifia.app/reset-password.html',
      });
      expect(result).toEqual({
        success: true,
      });
    });

    it('should handle user not found error', async () => {
      const email = 'nonexistent@example.com';
      const mockError = { message: 'User not found' };
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: mockError });

      const result = await authApi.forgotPassword(email);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FORGOT_PASSWORD_FAILED',
          message: 'User not found',
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password', async () => {
      const token = 'reset-token-123';
      const newPassword = 'newpassword123';
      const mockResponse = { error: null };
      mockSupabase.auth.updateUser.mockResolvedValue(mockResponse);

      const result = await authApi.resetPassword(token, newPassword);

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: newPassword,
      });
      expect(result).toEqual({
        success: true,
      });
    });

    it('should handle reset password error', async () => {
      const token = 'reset-token-123';
      const newPassword = 'newpassword123';
      const mockError = { message: 'Invalid token' };
      mockSupabase.auth.updateUser.mockResolvedValue({ error: mockError });

      const result = await authApi.resetPassword(token, newPassword);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'RESET_PASSWORD_FAILED',
          message: 'Invalid token',
        },
      });
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', async () => {
      const token = 'valid-token-123';
      const mockResponse = {
        data: { user: { id: 'user123' } },
        error: null,
      };
      mockSupabase.auth.getUser.mockResolvedValue(mockResponse);

      const result = await authApi.validateToken(token);

      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith(token);
      expect(result).toBe(true);
    });

    it('should invalidate invalid token', async () => {
      const token = 'invalid-token-123';
      const mockResponse = {
        data: { user: null },
        error: { message: 'Invalid token' },
      };
      mockSupabase.auth.getUser.mockResolvedValue(mockResponse);

      const result = await authApi.validateToken(token);

      expect(result).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const refreshToken = 'refresh-token-123';
      const mockResponse = {
        data: {
          user: {
            id: 'user123',
            email: 'test@example.com',
            created_at: '2023-01-01T00:00:00Z',
          },
          session: {
            access_token: 'new-token-123',
            refresh_token: 'new-refresh-123',
          },
        },
        error: null,
      };
      mockSupabase.auth.refreshSession.mockResolvedValue(mockResponse);

      // Mock helper methods
      jest.spyOn(authApi as any, 'getUserProfile').mockResolvedValue({
        first_name: 'Test',
        last_name: 'User',
      });

      const result = await authApi.refreshToken(refreshToken);

      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: refreshToken,
      });
      expect(result.success).toBe(true);
      expect(result.data?.user).toBeDefined();
    });

    it('should handle refresh token error', async () => {
      const refreshToken = 'invalid-refresh-token';
      const mockResponse = {
        data: null,
        error: { message: 'Invalid refresh token' },
      };
      mockSupabase.auth.refreshSession.mockResolvedValue(mockResponse);

      const result = await authApi.refreshToken(refreshToken);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Failed to refresh authentication',
        },
      });
    });
  });
});
