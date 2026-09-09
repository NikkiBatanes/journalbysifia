// src/navigation/TabBarIcons.ts

/**
 * TabBarIcons maps tab names to their Ionicons icon names for focused and unfocused states.
 */
export const TabBarIcons = {
  Today: {
    name: 'sunny-outline',
    focused: 'sunny',
  },
  Dashboard: {
    name: 'grid-outline',
    focused: 'grid',
  },
  UserInput: {
    name: 'chatbubble',
    focused: 'chatbubble',
  },
  Playbooks: {
    name: 'book',
    focused: 'book',
  },
  Profile: {
    name: 'person',
    focused: 'person',
  },
  Journal: {
    name: 'calendar-outline',
    focused: 'calendar',
  },
  Moments: {
    name: 'time-outline',
    focused: 'time',
  },
} as const;
