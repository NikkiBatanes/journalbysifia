import { StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

export const progressBarStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
    paddingRight: 100, // Increased space for delete button and task count
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  progressWrapper: {
    flex: 1,
    marginRight: 16, // Space between progress bar and task count
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
  text: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    minWidth: 30, // Further reduced width
    textAlign: 'right',
    paddingLeft: 5, // Minimal left padding
  },
});
