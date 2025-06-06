// src/navigation/TabBarIcons.ts

/**
 * TabBarIcons maps tab names to their Ionicons icon names for focused and unfocused states.
 */
export const TabBarIcons = {
  Home: {
    name: 'home-outline',
    focused: 'home',
  },
  Playbooks: {
    name: 'book-outline',
    focused: 'book',
  },
  Profile: {
    name: 'person-outline',
    focused: 'person',
  },
} as const;
