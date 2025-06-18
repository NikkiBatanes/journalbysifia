// src/navigation/TabBarIcons.ts

/**
 * TabBarIcons maps tab names to their Ionicons icon names for focused and unfocused states.
 */
export const TabBarIcons = {
  UserInput: {
    name: 'home-outline',
    focused: 'home',
  },
  Playbooks: {
    name: 'book-outline',
    focused: 'book',
  },
  Devotionals: {
    name: 'journal-outline',
    focused: 'journal',
  },
  Profile: {
    name: 'person-outline',
    focused: 'person',
  },
} as const;
