import { Playbook } from '../interfaces/playbook';

export type RootStackParamList = {
  // Auth Stack
  Auth: { screen: 'Login' | 'Register' } | undefined;
  Login: { onLogin: () => void } | undefined;
  Register: { onRegister: () => void } | undefined;

  // Onboarding Stack
  OnboardingSplash: undefined;
  OnboardingWhenToOpenSiFia: undefined;
  OnboardingPosture: undefined;
  OnboardingAccountCreation: undefined;
  OnboardingWelcome: undefined;

  OnboardingPersonalProfile: undefined;
  OnboardingTrialSetup: undefined;
  OnboardingPersonalization: { name?: string; registrationMethod?: 'email' | 'oauth'; step?: number; rewriteData?: any } | undefined;
  OnboardingNotificationPermission: { playbook?: Playbook } | undefined;

  // New Simplified Onboarding Flow Screens
  OnboardingPlaybookReady: {
    playbook: Playbook;
    onboardingData: {
      name: string;
      ageGroup: string;
      faithJourney: string;
      challengeDetails: string;
    };
  };
  OnboardingSalesOffer: {
    upgradeMode?: boolean;
    currentTier?: string;
    source?: string;
    feature?: string;
    tier?: string;
    skipNotificationPreference?: boolean;
  } | undefined;
  // RE-ENABLED: Trial Offer screen for trial flow navigation
  OnboardingTrialOffer: {
    source?: string;
    feature?: string;
    skipNotificationPreference?: boolean;
    returnTo?: string;
    context?: string;
    dismissBothModalsOnClose?: boolean;
    onboardingFlow?: boolean;
  } | undefined;
  OnboardingPaymentConfirmation: {
    userType: 'trial' | 'paid' | 'freemium';
    selectedTier?: string;
    isAnnual?: boolean;
    price?: number;
    isDiscounted?: boolean;
    discountPercentage?: number;
  };
  OnboardingNotificationSetup: {
    userType: 'trial' | 'paid' | 'freemium';
  };

  // Main App
  MainTabs: undefined;
  UserProfileModal: undefined;
  UserInput: { initialText?: string } | undefined;
  PlaybookDetail: {
    playbook: Playbook;
    isFromOnboarding?: boolean;
    onboardingData?: {
      name: string;
      ageGroup: string;
      faithJourney: string;
      challenge: string;
      challengeDetails: string;
    };
  };
  GeneratingPlaybook: {
    userInput: string;
    userName: string;
    isFromOnboarding?: boolean;
    onboardingData?: {
      ageGroup: string;
      faithJourney: string;
      challenge: string;
      challengeDetails: string;
    };
  };
  // Devotional screens
  Devotionals: undefined;
  DevotionalDetail: { devotionalId: string };

  // Journal screen
  Journal: undefined;

  // Test screens
  QueryTest: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Playbooks: undefined;
  Devotionals: undefined;
  Profile: undefined;
};

// This helps with type checking the navigation props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
