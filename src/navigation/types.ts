import { Playbook } from '../interfaces/playbook';

export type RootStackParamList = {
  // Auth Stack
  Auth: undefined;
  Login: { onLogin: () => void } | undefined;
  Register: { onRegister: () => void } | undefined;

  // Main App
  MainTabs: undefined;
  PlaybookDetail: { playbook: Playbook };
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
  };
  // Devotional screens
  Devotionals: undefined;
  DevotionalDetail: { devotionalId: string };
  DevotionalList: undefined;
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
