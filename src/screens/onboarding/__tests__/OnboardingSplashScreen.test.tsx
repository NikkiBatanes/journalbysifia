/**
 * OnboardingSplashScreen.test.tsx
 * Comprehensive test suite for splash screen navigation logic
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import OnboardingSplashScreen from '../OnboardingSplashScreen';
import { useAuth } from '../../../context/IndustryStandardAuthContext';
import { supabase } from '../../../services/supabaseClient';

// Mock dependencies
jest.mock('../../../context/IndustryStandardAuthContext');
jest.mock('../../../services/supabaseClient');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../../services/onboardingService');

const mockNavigation = {
  reset: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('OnboardingSplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderWithNavigation = (component: React.ReactElement) => {
    return render(
      <NavigationContainer>
        {component}
      </NavigationContainer>
    );
  };

  describe('Navigation Logic', () => {
    it('should navigate to welcome screen when no user is authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoggingOut: false,
      } as any);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      renderWithNavigation(<OnboardingSplashScreen />);

      // Fast-forward past the 2-second timeout
      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'TransformJourney' }],
        });
      });
    });

    it('should navigate to MainTabs when user has completed onboarding', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoggingOut: false,
      } as any);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      // Mock onboarding service to return completed
      const { OnboardingService } = require('../../../services/onboardingService');
      OnboardingService.prototype.hasCompletedOnboarding = jest.fn().mockResolvedValue(true);

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      });
    });

    it('should navigate to personalization when user has not completed onboarding', async () => {
      const mockUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      };
      
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoggingOut: false,
      } as any);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const { OnboardingService } = require('../../../services/onboardingService');
      OnboardingService.prototype.hasCompletedOnboarding = jest.fn().mockResolvedValue(false);

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith(
          expect.objectContaining({
            index: 0,
            routes: expect.arrayContaining([
              expect.objectContaining({ name: 'OnboardingPersonalization' })
            ]),
          })
        );
      });
    });

    it('should handle post-auth redirect correctly', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoggingOut: false,
      } as any);

      const redirectData = {
        target: 'OnboardingPersonalization',
        params: { name: 'John' },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(redirectData));
      
      const { OnboardingService } = require('../../../services/onboardingService');
      OnboardingService.prototype.hasCompletedOnboarding = jest.fn().mockResolvedValue(false);

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalled();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('post_auth_redirect');
      });
    });
  });

  describe('Memory Management', () => {
    it('should cleanup timeout on unmount', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoggingOut: false,
      } as any);

      const { unmount } = renderWithNavigation(<OnboardingSplashScreen />);

      // Unmount before timeout completes
      unmount();

      // Verify no timers are running
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should not navigate after component unmounts', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoggingOut: false,
      } as any);

      const { unmount } = renderWithNavigation(<OnboardingSplashScreen />);

      // Unmount immediately
      unmount();

      // Try to advance timers
      jest.advanceTimersByTime(2000);

      // Navigation should not be called
      expect(mockNavigation.reset).not.toHaveBeenCalled();
    });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent concurrent navigation attempts', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        isLoggingOut: false,
      } as any);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { OnboardingService } = require('../../../services/onboardingService');
      OnboardingService.prototype.hasCompletedOnboarding = jest.fn().mockResolvedValue(true);

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should fallback to welcome screen on navigation error', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoggingOut: false,
      } as any);

      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'OnboardingWelcome' }],
        });
      });
    });

    it('should handle session check failures gracefully', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoggingOut: false,
      } as any);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalled();
      });
    });
  });

  describe('Logout Handling', () => {
    it('should navigate to welcome screen when logging out', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        isLoggingOut: true,
      } as any);

      renderWithNavigation(<OnboardingSplashScreen />);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'OnboardingWelcome' }],
        });
      });
    });
  });
});
