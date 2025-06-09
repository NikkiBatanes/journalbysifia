import { StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

export const progressBarStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingRight: 90, // Space for delete button
    justifyContent: 'space-between',
  },
  progressWrapper: {
    flex: 1,
    minWidth: 0, // Ensure flex-shrink works properly
    marginRight: 8, // Space between progress bar and task count
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
    minWidth: 70, // Fixed width for consistent alignment
    textAlign: 'right',
    marginLeft: 'auto', // Push to the right
  },
});
