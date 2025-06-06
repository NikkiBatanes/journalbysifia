// src/constants/tabBarIcons.ts
import { IconName } from '../theme';

export const TabBarIcons: Record<string, { name: IconName; focused: IconName }> = {
  Home: { name: 'home-outline', focused: 'home' },
  Playbooks: { name: 'book-outline', focused: 'book' },
  Profile: { name: 'person-outline', focused: 'person' },
};

export type { IconName };
