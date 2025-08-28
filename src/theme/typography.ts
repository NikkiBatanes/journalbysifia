// src/theme/typography.ts

import { TextStyle } from 'react-native';
import { Fonts } from './fonts';

export const Typography = {
  // Keep existing keys for backward compatibility, but map to app default font (Lexend)
  interRegular: {
    fontFamily: Fonts.regular,
    fontWeight: '400',
  } as TextStyle,
  interSemiBold: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  } as TextStyle,
  interBold: {
    fontFamily: Fonts.bold,
    fontWeight: '700',
  } as TextStyle,
  interBlack: {
    fontFamily: Fonts.bold,
    fontWeight: '900',
  } as TextStyle,
};

// Example usage:
// import { Typography } from '../theme/typography';
// <Text style={[Typography.interSemiBold, { fontSize: 16 }]}>Text</Text>
