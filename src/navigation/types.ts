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

  OnboardingPaymentConfirmation: {
    userType: 'trial' | 'paid' | 'freemium';
    selectedTier?: string;
    isAnnual?: boolean;
    price?: number;
    isDiscounted?: boolean;
    discountPercentage?: number;
  };
  OnboardingNotificationSetup: undefined;

  // Journal first-launch onboarding (local AsyncStorage flag, no auth)
  JournalOnboarding: undefined;

  // Main App
  MainTabs: undefined;
  Gospel: undefined;
  ForMeDay: { mode?: 'celebrate' | 'settings' } | undefined;
  UserProfileModal: undefined;
  PlaybookDetail: {
    playbook: Playbook;
    isFromOnboarding?: boolean;
    onboardingData?: {
      name: string;
      birthDate?: string;
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
    fromNotification?: boolean;
  };
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

  GratitudeWalkthrough: {
    selectedDate?: string;
  } | undefined;

  FuturePlanning: {
    selectedDate: string;
    isTomorrow: boolean;
  };

  // Today's Win Walkthrough
  TodaysWinWalkthrough: {
    selectedDate?: string;
  } | undefined;

  // Prayer Journal Walkthrough
  PrayerJournalWalkthrough: {
    selectedDate?: string;
    initialPrayerType?: 'acts' | 'open';
    showDescription?: boolean;
    editingPrayerId?: string;
    subtaskTitle?: string;
    subtaskId?: string;
    stepId?: string;
    playbookId?: string;
    playbookTitle?: string;
    playbookStatus?: string;
    actionStepNumber?: number;
    actionStepTitle?: string;
    stepBody?: string;
    stepExample?: string | null;
    fromPlaybook?: boolean;
    fromNotificationAnsweredCheck?: boolean;
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
    subtaskTitle?: string;
    subtaskId?: string;
    stepId?: string;
    playbookId?: string;
    playbookTitle?: string;
    playbookStatus?: string;
    actionStepNumber?: number;
    actionStepTitle?: string;
    stepBody?: string;
    stepExample?: string | null;
    fromPlaybook?: boolean;
    fromNotificationAnsweredCheck?: boolean;
  } | undefined;

  // Unified Prayer Selection
  UnifiedPrayerSelection: {
    metadata?: {
      selectedDate?: string;
      subtaskTitle?: string;
      subtaskId?: string;
      stepId?: string;
      playbookId?: string;
      playbookTitle?: string;
      playbookStatus?: string;
      actionStepNumber?: number;
      actionStepTitle?: string;
      stepBody?: string;
      stepExample?: string | null;
    };
    fromPlaybook?: boolean;
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

  StreakPlan: {
    playbookId?: string;
    userId?: string;
    source?: string;
    onboarding?: boolean;
    dismissRouteCount?: number;
    returnTo?: 'journal';
  } | undefined;

  // Admin Dashboard
  AdminDashboard: undefined;

  // Test screens
  QueryTest: undefined;
};

export type BottomTabParamList = {
  Today: undefined;
  Journal: undefined;
  Prayer: undefined;
  More: undefined;
};

// This helps with type checking the navigation props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
