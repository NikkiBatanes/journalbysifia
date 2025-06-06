// src/theme/typography.ts

import { TextStyle } from 'react-native';

export const Typography = {
  interRegular: {
    fontFamily: 'Inter-Regular',
    fontWeight: '500',
  } as TextStyle,
  interSemiBold: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '500',
  } as TextStyle,
  interBold: {
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  } as TextStyle,
  interBlack: {
    fontFamily: 'Inter-Black',
    fontWeight: '900',
  } as TextStyle,
};

// Example usage:
// import { Typography } from '../theme/typography';
// <Text style={[Typography.interSemiBold, { fontSize: 16 }]}>Text</Text>
