// src/theme/styles.ts

export const Spacing = {
  tabBarPaddingTop: 8,
  tabBarPaddingBottom: 12,
  tabBarHeight: 64,
  profileLogoutMarginRight: 15,
} as const;

export const FontSizes = {
  profileLogout: 20,
} as const;

export const BorderRadii = {
  avatar: 16,
  card: 12,
  cardLarge: 16,
  cardXL: 24,
  button: 8,
  input: 12,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
};
