import { Playbook } from '../interfaces/playbook';

type OfferDismissBehavior = 'goBack' | 'userInput' | 'notificationSetup';

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
    selectedTier?: string;
    billingCycle?: 'monthly' | 'annual';
    currentTrialBillingCycle?: 'monthly' | 'annual';
    selectedBillingCycle?: 'monthly' | 'annual';
    source?: string;
    feature?: string;
    tier?: string;
    skipNotificationPreference?: boolean;
    dismissBehavior?: OfferDismissBehavior;
    currentTrialChosenTier?: string;
    profileTrialViewPlans?: boolean;
    testModeTier?: string;
    testModeIsOnTrial?: boolean;
    testModeHasStartedTrial?: boolean;
    testModeHasEverStartedTrial?: boolean;
    testModeTrialChosenTier?: string;
    testModeTrialEndDate?: string;
    testModeBillingCycle?: 'monthly' | 'annual';
    testModeRemaining?: number;
    testModeLimit?: number;
  } | undefined;
  // RE-ENABLED: Trial Offer screen for trial flow navigation
  OnboardingTrialOffer: {
    selectedTierId?: string;
    billing?: 'monthly' | 'annual';
    source?: string;
    feature?: string;
    skipNotificationPreference?: boolean;
    returnTo?: string;
    context?: string;
    dismissBothModalsOnClose?: boolean;
    dismissBehavior?: OfferDismissBehavior;
    onboardingFlow?: boolean;
    isTrialEligible?: boolean;
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
  UserInput: { initialText?: string; autoFocus?: boolean } | undefined;
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
  PlaybookWalkthrough: {
    playbook: Playbook;
    source?: 'user_input' | 'playbook_list' | 'onboarding';
    initialStep?: number;
    initialActionIndex?: number;
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

  // Today's Focus Walkthrough
  TodaysFocusWalkthrough: {
    selectedDate?: string;
    existingEntry?: any;
  } | undefined;

  // Tomorrow in His Hands Walkthrough
  TomorrowInHisHandsWalkthrough: {
    selectedDate?: string;
    existingEntry?: any;
  } | undefined;

  // Todos Walkthrough
  TodosWalkthrough: {
    selectedDate?: string;
    existingEntry?: any;
  } | undefined;

  // Today's Win Walkthrough
  TodaysWinWalkthrough: {
    selectedDate?: string;
  } | undefined;

  // Prayer Journal Walkthrough
  PrayerJournalWalkthrough: {
    selectedDate?: string;
    initialPrayerType?: 'acts' | 'open';
    editingPrayerId?: string;
  } | undefined;

  // Prayers for People Walkthrough
  PrayersForPeopleWalkthrough: {
    initialPersonName?: string;
    initialPrayerRequest?: string;
    selectedDate?: string;
    editingPrayerId?: string;
    initialPrayerType?: 'prayer-request' | 'pray-for-someone';
    initialPrayerText?: string;
    initialTrackAnswered?: boolean;
  } | undefined;

  // Prayer Editor Screen
  PrayerEditor: {
    prayerRequest: {
      person_name: string;
      content: string;
      id: string;
      user_id: string;
      selected_date: string;
    };
  };

  // Test screens
  QueryTest: undefined;
};

export type BottomTabParamList = {
  Reflect: undefined;
  Overview: undefined;
  Playbooks: undefined;
  Devotionals: undefined;
  Journal: undefined;
};

// This helps with type checking the navigation props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
