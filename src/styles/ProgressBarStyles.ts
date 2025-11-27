import { StyleSheet } from 'react-native';
import { Colors } from '../theme';

export const progressBarStyles = StyleSheet.create({
  container: {
    marginTop: 4,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 16, // Fixed height for the entire row
  },
  progressWrapper: {
    flex: 1,
    marginRight: 8, // Reduced spacing to give more room for text
    minWidth: 60, // Minimum width for the progress bar
  },
  barBg: {
    width: '100%',
    height: 6, // Thinner bar for more compact appearance
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
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
    fontSize: 10, // Smaller font for more compact appearance
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
    flexShrink: 1, // Allow shrinking but maintain readability
    includeFontPadding: false, // Remove extra font padding
    textAlignVertical: 'center', // Better vertical alignment
    lineHeight: 14, // Tighter line height
  },
});
