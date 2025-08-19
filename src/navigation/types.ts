import { Playbook } from '../interfaces/playbook';

export type RootStackParamList = {
  // Auth Stack
  Auth: { screen: 'Login' | 'Register' } | undefined;
  Login: { onLogin: () => void } | undefined;
  Register: { onRegister: () => void } | undefined;

  // Onboarding Stack
  OnboardingSplash: undefined;
  OnboardingWelcome: undefined;

  OnboardingPersonalProfile: undefined;
  OnboardingGoalsScreen: undefined;
  OnboardingTrialSetup: undefined;
  OnboardingPersonalization: { name?: string; registrationMethod?: 'email' | 'oauth' } | undefined;
  OnboardingNotificationPermission: { playbook?: Playbook } | undefined;
  OnboardingComplete: { playbook?: Playbook } | undefined;

  // New Simplified Onboarding Flow Screens
  OnboardingPlaybookReady: {
    playbook: Playbook;
    onboardingData: {
      name: string;
      ageGroup: string;
      faithJourney: string;
      challenge: string;
      challengeDetails: string;
    };
  };
  OnboardingSalesOffer: undefined;
  OnboardingTrialOffer: undefined;
  OnboardingPaymentProcessing: {
    selectedTier?: string;
    isAnnual?: boolean;
    price?: number;
    isDiscounted?: boolean;
    discountPercentage?: number;
  };
  OnboardingPaymentConfirmation: {
    userType: 'trial' | 'paid' | 'freemium';
    selectedTier?: string;
    isAnnual?: boolean;
  };
  OnboardingNotificationSetup: {
    userType: 'trial' | 'paid' | 'freemium';
  };

  // Main App
  MainTabs: undefined;
  UserProfileModal: undefined;
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
  CardDetail: {
    cardType: string;
    cardData: any;
    playbook: any;
    progress: number;
    completedTasks: number;
    totalTasks: number;
    viewMode: 'stack' | 'document';
    onToggleView?: (mode: 'stack' | 'document') => void; // Made optional
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
