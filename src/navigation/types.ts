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
    totalTasks: number;
    viewMode: 'stack' | 'document';
    onToggleView: (mode: 'stack' | 'document') => void;
  };
};

export type BottomTabParamList = {
  Home: undefined;
  Playbooks: undefined;
  Profile: undefined;
};

// This helps with type checking the navigation props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
