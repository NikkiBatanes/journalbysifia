// src/navigation/TabBarIcons.ts

/**
 * TabBarIcons maps tab names to their Ionicons icon names for focused and unfocused states.
 */
export const TabBarIcons = {
  UserInput: {
    name: 'chatbubble',
    focused: 'chatbubble',
  },
  Playbooks: {
    name: 'book',
    focused: 'book',
  },
  Devotionals: {
    name: 'journal',
    focused: 'journal',
  },
  Profile: {
    name: 'person',
    focused: 'person',
  },
} as const;
