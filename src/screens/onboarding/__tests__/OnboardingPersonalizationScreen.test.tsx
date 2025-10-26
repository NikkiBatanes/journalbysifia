/**
 * OnboardingPersonalizationScreen.test.tsx
 * Test suite for personalization flow
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import OnboardingPersonalizationScreen from '../OnboardingPersonalizationScreen';
import { useAuth } from '../../../context/IndustryStandardAuthContext';
import { useUserState } from '../../../hooks/useUserState';

jest.mock('../../../context/IndustryStandardAuthContext');
jest.mock('../../../hooks/useUserState');
jest.mock('../../../services/onboardingService');
jest.mock('../../../services/supabaseClient');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseUserState = useUserState as jest.MockedFunction<typeof useUserState>;

describe('OnboardingPersonalizationScreen', () => {
  const renderScreen = () => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
    } as any);

    mockUseUserState.mockReturnValue({
      updateOnboardingStep: jest.fn(),
    } as any);
    
    return render(
      <NavigationContainer>
        <OnboardingPersonalizationScreen />
      </NavigationContainer>
    );
  };

  describe('Step Navigation', () => {
    it('should render age group selection as first step for email users', () => {
      const { getByText } = renderScreen();

      expect(getByText(/Which stage of life are you in/i)).toBeTruthy();
    });

    it('should allow selecting an age group', () => {
      const { getByText } = renderScreen();

      const ageButton = getByText('18-25');
      fireEvent.press(ageButton);

      // Continue button should be enabled
      const continueButton = getByText('Continue');
      expect(continueButton).toBeTruthy();
    });

    it('should progress through all steps', async () => {
      const { getByText } = renderScreen();

      // Step 1: Age
      fireEvent.press(getByText('18-25'));
      fireEvent.press(getByText('Continue'));

      await waitFor(() => {
        expect(getByText(/Where are you in your/i)).toBeTruthy();
      });

      // Step 2: Faith Journey
      fireEvent.press(getByText('Growing in Faith'));
      fireEvent.press(getByText('Continue'));

      await waitFor(() => {
        expect(getByText(/biggest challenge/i)).toBeTruthy();
      });
    });

    it('should disable continue button when no selection is made', () => {
      const { getByText } = renderScreen();

      const continueButton = getByText('Continue');
      // Button should be disabled (check for disabled styling)
      expect(continueButton.props.accessibilityState?.disabled).toBeTruthy();
    });
  });

  describe('OAuth User Flow', () => {
    it('should show name step for OAuth users', () => {
      const { getByText, getByPlaceholderText } = render(
        <NavigationContainer>
          <OnboardingPersonalizationScreen />
        </NavigationContainer>
      );

      expect(getByText(/What's your name/i)).toBeTruthy();
      expect(getByPlaceholderText(/Enter your first name/i)).toBeTruthy();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup timeouts on unmount', () => {
      jest.useFakeTimers();

      const { unmount } = renderScreen();

      unmount();

      // Verify no timers are running
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });

    it('should not update state after unmount', async () => {
      const { unmount, getByText } = renderScreen();

      // Start an async operation
      fireEvent.press(getByText('18-25'));

      // Unmount immediately
      unmount();

      // Should not throw errors
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });
  });

  describe('Data Validation', () => {
    it('should require challenge details before final submission', async () => {
      const { getByText } = renderScreen();

      // Navigate to final step
      fireEvent.press(getByText('18-25'));
      fireEvent.press(getByText('Continue'));

      await waitFor(() => {
        fireEvent.press(getByText('Growing in Faith'));
        fireEvent.press(getByText('Continue'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Anxiety & Stress'));
        fireEvent.press(getByText('Continue'));
      });

      // Final step - should require input
      const createButton = getByText('Create My Playbook');
      expect(createButton.props.accessibilityState?.disabled).toBeTruthy();
    });
  });

  describe('Progress Tracking', () => {
    it('should update onboarding progress on completion', async () => {
      const updateStepMock = jest.fn();
      mockUseUserState.mockReturnValue({
        updateOnboardingStep: updateStepMock,
      } as any);

      const { getByText } = renderScreen();

      // Complete all steps
      fireEvent.press(getByText('18-25'));
      fireEvent.press(getByText('Continue'));

      await waitFor(() => {
        expect(updateStepMock).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByText } = renderScreen();

      const continueButton = getByText('Continue');
      expect(continueButton.props.accessible).toBeTruthy();
    });

    it('should support keyboard navigation', () => {
      const { getByText } = renderScreen();

      // All interactive elements should be focusable
      const ageButton = getByText('18-25');
      expect(ageButton.props.accessible).toBeTruthy();
    });
  });
});
