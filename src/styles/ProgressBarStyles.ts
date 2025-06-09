import { StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

export const progressBarStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  progressWrapper: {
    flex: 1,
    marginRight: 4, // Reduced spacing
  },
  barBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 4,
  },
  textContainer: {
    width: 60, // Reduced width
    alignItems: 'flex-end',
  },
  text: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
  },
});
