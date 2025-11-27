import { StyleSheet } from 'react-native';
import { Colors } from '../theme';

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
    marginRight: 8, // Reduced spacing to give more room for text
    minWidth: 60, // Minimum width for the progress bar
  },
  barBg: {
    width: '100%',
    height: 10, // Slightly thicker bar
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 5,
    shadowColor: Colors.growthGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  textContainer: {
    minWidth: 65, // Minimum width for shorter text like "0/5"
    maxWidth: 85, // Maximum width for longer text like "12/15"
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11, // Slightly smaller to fit better
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
    flexShrink: 1, // Allow shrinking but maintain readability
    includeFontPadding: false, // Remove extra font padding
    textAlignVertical: 'center', // Better vertical alignment
  },
});
