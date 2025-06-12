// src/navigation/TabBarIcons.ts

/**
 * TabBarIcons maps tab names to their Ionicons icon names for focused and unfocused states.
 */
export const TabBarIcons = {
  UserInput: {
    name: 'add-circle-outline',
    focused: 'add-circle',
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
