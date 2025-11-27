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
    height: 20, // Increased from 16 to accommodate thicker bar
  },
  progressWrapper: {
    flex: 1, // Reduced from 1 to make it narrower
    marginRight: 8,
    minWidth: 180, // Reduced from 60 to make it narrower
    maxWidth: 280, // Add maximum width to prevent it from getting too wide
  },
  barBg: {
    width: '100%',
    height: 10, // Increased from 6 to make it thicker
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 5, // Increased border radius to match new height
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
