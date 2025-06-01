import { Playbook } from '../interfaces/playbook';

export type RootStackParamList = {
  // Auth Stack
  Auth: undefined;
  Login: { onLogin: () => void } | undefined;
  Register: { onRegister: () => void } | undefined;
  
  // Main App
  MainTabs: undefined;
  PlaybookDetail: { playbook: Playbook };
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
